import * as Y from 'yjs'
import {Decoration,WidgetType,type DecorationSet} from '@codemirror/view'
import type {Range} from '@codemirror/state'

export interface RelativeSelection {anchor:string;head:string}
export interface LocalSelection {anchor:number;head:number}
export interface CollaborationPeer {
 connection_id:string
 user_id:string
 name:string
 role:'owner'|'editor'|'viewer'
 selection?:RelativeSelection
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const maxPositionBytes=128
const MAX_PEERS=6
const palette=['#2563eb','#b45309','#7c3aed','#047857','#be185d','#0e7490']
export function peerColor(id:string){
 let h=0
 for(const c of id)h=(Math.imul(h,31)+c.charCodeAt(0))>>>0
 return palette[h%palette.length]!
}
function validId(id:unknown):id is string{
 return typeof id==='string'&&UUID.test(id)&&id!=='00000000-0000-0000-0000-000000000000'
}
function decodePosition(encoded:unknown):Uint8Array{
 if(typeof encoded!=='string'||!encoded.length||encoded.length>4*Math.ceil(maxPositionBytes/3))throw Error('invalid position')
 const raw=atob(encoded)
 if(!raw.length||raw.length>maxPositionBytes||btoa(raw)!==encoded)throw Error('invalid position')
 return Uint8Array.from(raw,c=>c.charCodeAt(0))
}
export function parsePresencePeers(value:unknown):CollaborationPeer[]{
 if(!Array.isArray(value)||value.length<1||value.length>MAX_PEERS)throw Error('invalid peers')
 const seen=new Set<string>()
 return value.map((p:unknown)=>{
  if(!p||typeof p!=='object')throw Error('invalid peer')
  const peer=p as Record<string,unknown>
  if(!validId(peer.connection_id)||!validId(peer.user_id)||seen.has(peer.connection_id)||
     typeof peer.name!=='string'||!peer.name.trim()||Array.from(peer.name).length>64||
     !['owner','editor','viewer'].includes(String(peer.role)))throw Error('invalid peer')
  seen.add(peer.connection_id)
  let selection:RelativeSelection|undefined
  if(peer.selection!==undefined){
   if(!peer.selection||typeof peer.selection!=='object')throw Error('invalid selection')
   const sel=peer.selection as Record<string,unknown>
   decodePosition(sel.anchor);decodePosition(sel.head)
   selection={anchor:sel.anchor as string,head:sel.head as string}
  }
  return {connection_id:peer.connection_id,user_id:peer.user_id,name:peer.name,role:peer.role as CollaborationPeer['role'],...(selection?{selection}:{})}
 })
}
export function encodeSelection(text:Y.Text,selection:LocalSelection|null):RelativeSelection|null {
 if(!selection)return null
 const encode=(index:number)=>{
  if(!Number.isSafeInteger(index)||index<0||index>text.length)throw Error('invalid local position')
  const bytes=Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(text,index))
  if(bytes.length>maxPositionBytes)throw Error('position too large')
  return btoa(String.fromCharCode(...bytes))
 }
 return {anchor:encode(selection.anchor),head:encode(selection.head)}
}
export function resolveSelection(text:Y.Text,selection:RelativeSelection):LocalSelection|null{
 if(!text.doc)return null
 try{
  const resolve=(encoded:string)=>{
   const pos=Y.createAbsolutePositionFromRelativePosition(Y.decodeRelativePosition(decodePosition(encoded)),text.doc!)
   return pos&&pos.type===text&&Number.isSafeInteger(pos.index)&&pos.index>=0&&pos.index<=text.length?pos.index:null
  }
  const anchor=resolve(selection.anchor),head=resolve(selection.head)
  return anchor===null||head===null?null:{anchor,head}
 }catch{return null}
}
class RemoteCursor extends WidgetType {
 constructor(readonly peer:CollaborationPeer){super()}
 eq(other:RemoteCursor){return other.peer.connection_id===this.peer.connection_id&&other.peer.name===this.peer.name}
 toDOM(){
  const cursor=document.createElement('span')
  cursor.className='papers-remote-cursor'
  cursor.style.borderLeftColor=peerColor(this.peer.connection_id)
  cursor.setAttribute('aria-label',this.peer.name+' 的光标')
  const label=document.createElement('span')
  label.className='papers-remote-cursor-label'
  label.style.backgroundColor=peerColor(this.peer.connection_id)
  label.textContent=this.peer.name
  cursor.appendChild(label)
  return cursor
 }
 ignoreEvent(){return true}
}
export function remoteCursorDecorations(text:Y.Text,peers:readonly CollaborationPeer[],docLength:number):DecorationSet{
 const ranges:Range<Decoration>[]=[]
 for(const peer of peers){
  if(!peer.selection)continue
  const resolved=resolveSelection(text,peer.selection)
  if(!resolved||resolved.anchor>docLength||resolved.head>docLength)continue
  const from=Math.min(resolved.anchor,resolved.head),to=Math.max(resolved.anchor,resolved.head)
  if(from<to)ranges.push(Decoration.mark({class:'papers-remote-selection',attributes:{style:'background-color:'+peerColor(peer.connection_id)+'26'}}).range(from,to))
  ranges.push(Decoration.widget({widget:new RemoteCursor(peer),side:1}).range(resolved.head))
 }
 return Decoration.set(ranges,true)
}
