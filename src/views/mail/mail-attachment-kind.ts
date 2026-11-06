export type SafeMailAttachmentType = 'png'|'jpeg'|'gif'|'webp'|'pdf'|'other'
export function sniffMailAttachmentType(bytes:Uint8Array):SafeMailAttachmentType {
 const prefix=(...v:number[])=>v.every((byte,i)=>bytes[i]===byte)
 if(prefix(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a))return 'png'
 if(prefix(0xff,0xd8,0xff))return 'jpeg'
 if(prefix(0x47,0x49,0x46,0x38) && (bytes[4]===0x37 || bytes[4]===0x39))return 'gif'
 if(prefix(0x52,0x49,0x46,0x46) && bytes[8]===0x57 && bytes[9]===0x45 && bytes[10]===0x42 && bytes[11]===0x50)return 'webp'
 if(prefix(0x25,0x50,0x44,0x46,0x2d))return 'pdf'
 return 'other'
}
