import "./style.scss";

import { vCard, msgBody } from "./utils"
import type { VCardProperty, SimpleVCardProperty, VCardObject } from "./utils";

const tabletWidth = 768;
const isSmartphoneMedia = window.matchMedia(`(width < ${tabletWidth}px)`);
const isSmartphone = () => isSmartphoneMedia.matches;

const back = document.getElementById("back") as HTMLButtonElement;
const partner = document.querySelector("header .partner") as HTMLDivElement;
const col = document.querySelector(".col") as HTMLDivElement;
const pick = document.querySelector("label .pick") as HTMLSpanElement;
const filePicker = document.getElementById("file-picker") as HTMLInputElement;
const vmgSelector = document.getElementById("vmg-selector") as HTMLSelectElement;
const contacts = document.getElementById("contacts") as HTMLUListElement;
const messages = document.getElementById("messages") as HTMLDivElement;

type formattedCts = {
  formattedName: string;
  sortString: string;
  telNumber: string;
};

const vcfFilesLoader = async (vcfFiles: File[]) => {
  const cts = (await Promise.all(vcfFiles.map(async (file) => {
    const text = await file.text();
    return vCard.parse(text);
  }))).flat();

  return (cts as VCardObject[]).map((contact) => {
      const formattedName = (contact["FN"] as VCardProperty)?.value || "";
      const sortString = (contact["SORT-STRING"] as VCardProperty)?.value || "";
      const telNumber = (contact["TEL"] as VCardProperty)?.value || "";
      return {
        formattedName,
        sortString,
        telNumber,
      };
  }) as formattedCts[];
};

const vmgFilesPrepare = (vmgFiles: File[]) => {
  vmgFiles.forEach((file) => {
    const option = document.createElement("option");
    option.value = file.name;
    option.textContent = file.name;
    vmgSelector.appendChild(option);
  });
  vmgSelector.hidden = false;
};

type VMessageObject = {
  "X-IRMC-TYPE"?: VCardProperty;
  "X-IRMC-BOX"?: VCardProperty;
  "VCARD"?: {
    "TEL"?: VCardProperty;
  };
  "VENV"?: {
    "VCARD"?: {
      "TEL"?: VCardProperty;
    };
    "VENV"?: {
      "VBODY"?: SimpleVCardProperty;
    };
  };
};

type formattedMsg = {
  type: string;
  box: string;
  from: string;
  to: string;
  date: Date;
  text: string;
};

const vmgFilesLoader = async (vmgFiles: File[]) => {
  const msgs = (await Promise.all(vmgFiles.map(async (file) => {
    const text = await file.text();
    return vCard.parse(text, "VMSG");
  }))).flat();

  return (msgs as VMessageObject[]).map((message) => {
      const type = message["X-IRMC-TYPE"]?.value || "";
      const box = message["X-IRMC-BOX"]?.value || "";
      const from = message["VCARD"]?.["TEL"]?.value || "";
      const to = message["VENV"]?.["VCARD"]?.["TEL"]?.value || "";
      const messageBody = message["VENV"]?.["VENV"]?.["VBODY"] || "";
      const bodyParsed = msgBody.parse(messageBody);
      const date = bodyParsed["Date"];
      const text = bodyParsed["Body"];
      return {
        type,
        box,
        from,
        to,
        date,
        text,
      };
  }) as formattedMsg[];
};

const resetFiles = () => {
  partner.textContent = "";
  vmgSelector.hidden = true;
  const vmgOptions = vmgSelector.querySelectorAll("option");
  [...vmgOptions].filter((_, i) => i).forEach((option) => option.remove());
  contacts.textContent = "";
  messages.textContent = "";
};

let cts: formattedCts[] = [];
const initialPickText = pick.textContent;
filePicker.addEventListener("change", async (e) => {
  const files = (e.target as HTMLInputElement).files;

  resetFiles();

  if (!files?.length) {
    pick.textContent = initialPickText;
    return;
  };

  const vcfFiles = [...files].filter((file) => file.type === "text/vcard" || file.type === "text/x-vcard" || file.name.endsWith(".vcf"));
  const vmgFiles = [...files].filter((file) => file.name.endsWith(".vmg"));

  pick.innerText = `${files.length}個のうち\n${vcfFiles.length + vmgFiles.length}個の有効なファイル`;

  cts = await vcfFilesLoader(vcfFiles);
  vmgFilesPrepare(vmgFiles);
});

const makeContactView = async (formattedCts: formattedCts[]) => {
  const html = formattedCts
    .sort((a, b) => {
      const aName = a.sortString || a.formattedName || a.telNumber;
      const bName = b.sortString || b.formattedName || b.telNumber;
      return aName.localeCompare(bName);
    }).map((contact) =>
    `<li>
      <button value="${contact.telNumber}" data-name="${contact.formattedName}">
        ${contact.formattedName ? `<div class="name">${contact.formattedName}</div>` : ""}
        <div class="tel">${contact.telNumber}</div>
      </button>
    </li>
    `
  ).join("\n");
  contacts.innerHTML = html;
};

const makeMessageView = async (formattedMsgs: formattedMsg[]) => {
  const html = formattedMsgs.filter((message) => message.type === "SMS")
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((message) => 
      `<div class="message-box ${message.box.toLowerCase()}" data-box="${message.box}" data-from="${message.from}" data-to="${message.to}">
        <div class="text">${message.text.replace(/\n/g, "<br>")}</div>
        <div class="date">${message.date.toLocaleString()}</div>
      </div>
      `
    ).join("\n");
  messages.innerHTML = html;
};

let vmsgs: formattedMsg[] = [];
const getPartnerTelNumberSet = () => 
  new Set<string>(vmsgs.map((message) => message.box === "INBOX" ? message.from : message.to).filter((telNumber) => telNumber));
vmgSelector.addEventListener("change", async (e) => {
  partner.textContent = "";
  contacts.textContent = "";
  messages.textContent = "";
  const selectedFile = (e.target as HTMLSelectElement).value;
  if (!selectedFile) {
    return;
  };
  const vmgFiles = [...filePicker.files!].filter((file) => file.name === selectedFile);
  vmsgs = await vmgFilesLoader(vmgFiles);
  const partnerTelNumbers = getPartnerTelNumberSet();
  const generatedCts = [...partnerTelNumbers].map((telNumber) => 
    cts.find((contact) => contact.telNumber === telNumber) || { formattedName: "", sortString: "", telNumber }
  );
  await makeContactView(generatedCts);
});

const switchPanel = (elem: HTMLElement) => {
  const pairElem = elem === col ? messages : col;
  pairElem.hidden = true;
  elem.hidden = false;
  if (elem === messages) {
    back.hidden = false;
  } else {
    back.hidden = true;
    partner.textContent = "";
    contacts.querySelector(".active")?.classList.remove("active");
    messages.textContent = "";
  }
};

back.addEventListener("click", () => {
  if (isSmartphone()) {
    switchPanel(col);
  }
});

contacts.addEventListener("click", async (e) => {
  const button = (e.target as HTMLElement).closest("button") as HTMLButtonElement;
  if (!button) {
      return;
  }
  contacts.querySelector(".active")?.classList.remove("active");
  button.classList.add("active");
  const telNumber = button.value;
  partner.textContent = button.dataset.name || button.value;
  const selectedMessages = vmsgs.filter((message) => {
    const messageTelNumber = message.box === "INBOX" ? message.from : message.to;
    return messageTelNumber === telNumber;
  });
  await makeMessageView(selectedMessages);
  if (isSmartphone()) {
    switchPanel(messages);
  }
});

const layoutControl = () => {
  if (isSmartphone()) {
    const isReading = contacts.querySelector(".active") !== null;
    if (isReading) {
      switchPanel(messages);
    } else {
      switchPanel(col);
    }
  } else {
    back.hidden = true;
    col.hidden = messages.hidden = false;
  }
};

layoutControl();
isSmartphoneMedia.addEventListener("change", layoutControl);
