import { request } from "../lib/api";
describe("bounded API requests",()=>{
 beforeEach(()=>{jest.useFakeTimers();global.fetch=jest.fn();});
 afterEach(()=>{delete global.fetch;jest.useRealTimers();});
 test("a stalled write times out, is cancelled and is never automatically retried",async()=>{
  global.fetch.mockImplementation(()=>new Promise(()=>{}));
  const pending=request("/profile/me",{method:"PATCH",body:'{"name":"Test"}',timeoutMs:50});
  const rejected=expect(pending).rejects.toMatchObject({status:0,code:"REQUEST_TIMEOUT",message:expect.stringContaining("140")});
  await jest.advanceTimersByTimeAsync(50);await rejected;
  expect(global.fetch).toHaveBeenCalledTimes(1);expect(global.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
 });
 test("the deadline also covers a response body that never finishes",async()=>{
  global.fetch.mockResolvedValue({ok:true,json:()=>new Promise(()=>{})});
  const pending=request("/providers",{timeoutMs:20});
  const rejected=expect(pending).rejects.toMatchObject({code:"REQUEST_TIMEOUT"});
  await jest.advanceTimersByTimeAsync(20);await rejected;
 });
 test("AI calls receive their longer deadline",async()=>{
  global.fetch.mockImplementation(()=>new Promise(()=>{}));
  const pending=request("/triage/ai-assess",{method:"POST"});
  const rejected=expect(pending).rejects.toMatchObject({code:"REQUEST_TIMEOUT"});
  await jest.advanceTimersByTimeAsync(30000);
  expect(global.fetch.mock.calls[0][1].signal.aborted).toBe(false);
  await jest.advanceTimersByTimeAsync(90000);await rejected;
 });
 test("successful reads retain cookies, custom headers and clean up timers",async()=>{
  global.fetch.mockResolvedValue({ok:true,json:async()=>({ok:true})});
  await expect(request("/providers",{headers:{"X-Test":"yes"}})).resolves.toEqual({ok:true});
  expect(global.fetch.mock.calls[0][1]).toMatchObject({credentials:"include",headers:{"Content-Type":"application/json","X-Test":"yes"}});
  expect(jest.getTimerCount()).toBe(0);
 });
 test("caller cancellation does not become a connectivity error",async()=>{
  global.fetch.mockImplementation(()=>new Promise(()=>{}));const control=new AbortController();
  const pending=request("/providers",{signal:control.signal});
  const rejected=expect(pending).rejects.toMatchObject({name:"AbortError"});
  control.abort();await rejected;expect(jest.getTimerCount()).toBe(0);
 });
 test("server status and reference IDs survive; network internals do not",async()=>{
  global.fetch.mockResolvedValueOnce({ok:false,status:400,json:async()=>({error:"Check your details.",requestId:"test-reference"})});
  await expect(request("/auth/login")).rejects.toMatchObject({status:400,message:"Check your details.",requestId:"test-reference"});
  global.fetch.mockRejectedValueOnce(new TypeError("private network details"));
  await expect(request("/providers")).rejects.toMatchObject({code:"NETWORK_UNAVAILABLE",message:expect.not.stringContaining("private")});
 });
});
