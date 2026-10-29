import { longDate } from "../lib/careCircleApi";
import { timeAgo } from "../lib/notificationApi";
import { formatDate } from "../lib/dates";
describe("English dates when the device's default language is Arabic",()=>{
 let native,spy;
 beforeEach(()=>{
  native=Date.prototype.toLocaleDateString;
  spy=jest.spyOn(Date.prototype,"toLocaleDateString").mockImplementation(function(locale,options){
   return native.call(this,locale===undefined?"ar-LB":locale,options);
  });
 });
 afterEach(()=>spy.mockRestore());
 test("care-circle dates use English month names",()=>{
  expect(longDate("2026-10-28T12:00:00Z")).toBe("28 October 2026");
 });
 test("older notification dates stay English rather than inheriting the device language",()=>{
  expect(timeAgo("2026-10-25T12:00:00Z",new Date("2026-10-28T12:00:00Z"))).toBe("25 October 2026");
 });
 test("date-only profile fields retain their English format and calendar day",()=>{
  expect(formatDate("2000-01-02")).toBe("2 January 2000");
 });
});
