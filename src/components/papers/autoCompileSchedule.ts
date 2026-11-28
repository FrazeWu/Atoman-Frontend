// Auto compilation is deliberately opt-in and scoped to one project/account.
// The timer is owned by the workspace; this policy contains no network or UI.
export class AutoCompileSchedule {
 private dirty=false
 private editedAt=0
 private attemptedAt:number|null=null
 private retryAt=0
 private retries=0
 private paused=false
 reset(){
  this.dirty=false;this.editedAt=0;this.attemptedAt=null
  this.retryAt=0;this.retries=0;this.paused=false
 }
 markDirty(now:number){
  this.dirty=true;this.editedAt=now
  this.retryAt=0;this.retries=0;this.paused=false
 }
 begin(now:number){this.attemptedAt=now}
 accepted(current:boolean){
  // An edit made while submitting must remain pending unless the accepted
  // immutable revision actually includes that edit.
  if(current)this.dirty=false
  this.retryAt=0;this.retries=0;this.paused=false
 }
 failed(now:number,retryable:boolean){
  if(!this.dirty)return
  if(!retryable||this.retries>=2){this.paused=true;return}
  this.retryAt=now+60_000*2**this.retries++
 }
 delay(now:number):number|null{
  if(!this.dirty||this.paused)return null
  return Math.max(0,this.editedAt+15_000-now,this.attemptedAt===null?0:this.attemptedAt+60_000-now,this.retryAt-now)
 }
}
