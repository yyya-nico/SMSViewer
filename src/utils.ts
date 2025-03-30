type VCardMeta = {
    [key: string]: string | boolean;
};

type VCardProperty = {
  meta?: VCardMeta;
  value?: string;
  values?: string[];
};
type SimpleVCardProperty = string;

type VCardObject = {
    [key: string]: VCardProperty | VCardObject;
} & {
    "VBODY"?: SimpleVCardProperty;
};

const vCard = {
    parse(text: string, container: string = "VCARD"): VCardObject[] {
        const lines = text.split(/\r\n|\r|\n/);
        const parsed: VCardObject[] = [];
        const nestObjs: VCardObject[] = [];
        let isVBody = false;
    
        for (const line of lines) {
            const [key, value] = line.split(":");

            if (isVBody || key && value) {
                if (key === "BEGIN") {
                    const obj: VCardObject = {};
                    if (value === container) {
                        parsed.push(obj);
                        nestObjs.push(obj);
                    } else if (nestObjs.at(-1)) {
                        if (value === "VBODY") {
                            nestObjs.at(-1)![value] = "";
                            isVBody = true;
                            continue;
                        }
                        nestObjs.at(-1)![value] = obj;
                        nestObjs.push(obj);
                    }
                    continue;
                }
        
                if (key === "END") {
                    if (value === "VBODY") {
                        isVBody = false;
                        continue;
                    }
                    nestObjs.pop();
                    continue;
                }
    
                const currentObj = nestObjs.at(-1);
                if (!currentObj) continue;

                if (isVBody) {
                    currentObj["VBODY"] += line + "\n";
                    continue;
                }

                const [property, ...meta] = key.split(";");
                const values = value.split(";");
                currentObj[property] = {
                    ...(meta.length > 0 ? {
                        meta: meta.reduce((acc, item) => {
                            const [key, value] = item.split("=");
                            acc[key] = value || true;
                            return acc;
                        }, {} as VCardMeta)
                    } : {}),
                    ...(values.length > 1 ? { values } : { value })
                }
            }
        }
    
        return parsed;
    },
}

const msgBody = {
    parse(text: string): {
        Date: Date;
        Body: string;
    } {
        const lines = text.split(/\r\n|\r|\n/);
        const parsed: {
            Date: Date;
            Body: string;
        } = {
            "Date": new Date(0),
            "Body": ""
        };
    
        for (const line of lines) {
            if (line.startsWith("CHARSET")) {
                continue;
            } else if (line.startsWith("Date:")) {
                const date = line.slice(5).trim();
                parsed["Date"] = new Date(date);
                continue;
            } else if (line === "") {
                continue;
            }

            parsed["Body"] += line + "\n";
        }
    
        return parsed;
    }
}

export type { VCardMeta, VCardProperty, SimpleVCardProperty, VCardObject };
export { vCard, msgBody };