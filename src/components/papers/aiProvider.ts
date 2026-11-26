export const paperAIModelPattern=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
export function validPaperAIBase(raw:string,custom:boolean,approved:string[]){
 const value=raw.trim().replace(/\/$/,'')
 if(!custom)return approved.includes(value)
 if(value.length>512||!/^https:\/\/[a-z0-9.-]+(?:\/[A-Za-z0-9_-]+)*$/.test(value))return false
 try{
  const u=new URL(value)
  const host=u.hostname
  if(!host.includes('.')||/^\d+(?:\.\d+)*$/.test(host)||host.length>253||host.split('.').some(part=>!part||part.length>63||part.startsWith('-')||part.endsWith('-')))return false
  if(['localhost','local','internal','localdomain','lan','home.arpa','onion','invalid','test','atoman.org'].some(s=>host===s||host.endsWith('.'+s)))return false
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash
 }catch{return false}
}
export function validPaperAIKey(value:string){
 return /^[!-~]{8,2048}$/.test(value)
}
