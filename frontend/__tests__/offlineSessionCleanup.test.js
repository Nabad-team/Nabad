import { signOut } from '../lib/session';
import { logout } from '../lib/api';
import Router from 'next/router';
import offline from '../public/offline-emergency';
jest.mock('../lib/api',()=>({logout:jest.fn()}));
jest.mock('next/router',()=>({__esModule:true,default:{replace:jest.fn()}}));
beforeEach(()=>{jest.resetAllMocks();localStorage.setItem(offline.KEY,'synthetic private copy');});
test('sign-out clears the offline copy before waiting for server logout',async()=>{
 let finish;logout.mockReturnValue(new Promise(resolve=>{finish=resolve;}));const pending=signOut();
 expect(localStorage.getItem(offline.KEY)).toBeNull();finish();await pending;expect(Router.replace).toHaveBeenCalledWith('/login');
});
test('offline logout failure still removes the saved copy, including account deletion sign-out',async()=>{
 logout.mockRejectedValue(new Error('offline'));await signOut('/?deleted=1');expect(localStorage.getItem(offline.KEY)).toBeNull();expect(Router.replace).toHaveBeenCalledWith('/?deleted=1');
});
