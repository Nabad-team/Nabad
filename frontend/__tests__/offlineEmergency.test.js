import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import offline from '../public/offline-emergency';
import OfflineEmergencyCard from '../components/OfflineEmergencyCard';
const card = { profile: { id: 'self', fullName: 'Offline Test', dateOfBirth: '1990-01-01' }, preparedAt:'2026-11-08T10:00:00Z', bloodType:'O+', conditions:[{code:'asthma'}], allergies:[{name:'Synthetic allergy',reaction:'Synthetic reaction'}], medications:[{name:'Synthetic medicine',dose:'5',unit:'mg',form:'tablet',frequency:'Daily'}],emergencyContact:{name:'Contact',phone:'+96170123456'}, passwordHash:'never save' };
const storedCard = { ...card, conditions:[{label:'Asthma'}], medications:[{name:'Synthetic medicine',dose:'5 mg tablet',frequency:'Daily'}] };
beforeEach(() => {
 localStorage.clear();
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{register:jest.fn().mockResolvedValue({update:jest.fn().mockResolvedValue()}),ready:Promise.resolve({})}});
 global.caches={open:jest.fn().mockResolvedValue({add:jest.fn().mockResolvedValue()})};
 global.Request=jest.fn(function(url,options){this.url=url;this.options=options;});
});
afterEach(() => { jest.restoreAllMocks(); document.body.innerHTML=''; });
test('saves only allowlisted visible fields and returns a versioned timestamped snapshot', () => {
 offline.save('owner@example.test',storedCard,new Date('2026-11-08T10:00:00Z'));
 const data=offline.read(); expect(data.card.profile.fullName).toBe('Offline Test');expect(data.savedAt).toBe('2026-11-08T10:00:00.000Z');
 expect(localStorage.getItem(offline.KEY)).not.toContain('never save');
});
test('corrupt, oversized or invalid phone snapshots are not displayed; unavailable storage fails safely', () => {
 localStorage.setItem(offline.KEY,'not json');expect(offline.read()).toBeNull();
 offline.save('owner@example.test',{...storedCard,emergencyContact:{name:'Bad',phone:'javascript:bad'}});expect(offline.read()).toBeNull();
 jest.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('blocked');});expect(offline.read()).toBeNull();
});
test('account changes and deleted linked profiles clear snapshots; switching among owned profiles does not', () => {
 offline.save('owner@example.test',storedCard);offline.reconcile('owner@example.test',['self','child']);expect(offline.read()).not.toBeNull();
 offline.reconcile('other@example.test',['self']);expect(offline.read()).toBeNull();
 offline.save('owner@example.test',{...storedCard,profile:{...storedCard.profile,id:'child'}});offline.reconcile('owner@example.test',['self']);expect(offline.read()).toBeNull();
});
test('public offline renderer uses text nodes, exposes contact calls and removes the saved copy', () => {
 offline.save('owner@example.test',{...storedCard,profile:{...storedCard.profile,fullName:'<img src=x onerror=alert(1)>'}});
 document.body.innerHTML='<section id="saved-emergency-card"></section>';offline.mount();
 expect(screen.getByRole('heading',{name:/Saved emergency information/})).toHaveTextContent('<img');expect(document.querySelector('img')).toBeNull();
 expect(screen.getByRole('link',{name:'+96170123456'})).toHaveAttribute('href','tel:+96170123456');
 fireEvent.click(screen.getByRole('button',{name:'Remove saved emergency information'}));expect(offline.read()).toBeNull();expect(screen.getByText(/No emergency card is saved/)).toBeInTheDocument();
});
test('nothing is stored automatically; explicit save prepares public offline resources before persisting', async () => {
 const user=userEvent.setup();render(<OfflineEmergencyCard card={card} owner="owner@example.test"/>);expect(offline.read()).toBeNull();
 await user.click(screen.getByRole('button',{name:'Save for offline use'}));
 expect(await screen.findByRole('status')).toHaveTextContent('saved for offline use');expect(offline.read().card.conditions).toEqual([{label:'Asthma'}]);
 expect(caches.open).toHaveBeenCalledWith('nabad-public-help-v2');
 await user.click(screen.getByRole('button',{name:'Remove offline copy'}));expect(offline.read()).toBeNull();
});
test('storage/cache errors do not report success or destroy an earlier saved snapshot', async () => {
 offline.save('owner@example.test',storedCard);caches.open.mockRejectedValue(new Error('offline'));
 const user=userEvent.setup();render(<OfflineEmergencyCard card={card} owner="owner@example.test"/>);
 await user.click(screen.getByRole('button',{name:'Save for offline use'}));expect(await screen.findByRole('status')).toHaveTextContent('Could not save');expect(offline.read().card.profile.fullName).toBe('Offline Test');
});
test('profile changes/unmount prevent a late save from persisting the previous patient', async () => {
 let finish; navigator.serviceWorker.register.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
 const user=userEvent.setup();const view=render(<OfflineEmergencyCard card={card} owner="owner@example.test"/>);
 await user.click(screen.getByRole('button',{name:'Save for offline use'}));view.unmount();
 await act(async()=>finish({update:async()=>{}}));expect(offline.read()).toBeNull();
});
test('an unavailable card cannot be saved and removing from another tab clears the visible offline page', () => {
 render(<OfflineEmergencyCard card={null} owner="owner@example.test"/>);expect(screen.getByRole('button',{name:'Save for offline use'})).toBeDisabled();
 offline.save('owner@example.test',storedCard);document.body.innerHTML='<section id="saved-emergency-card"></section>';offline.mount();
 localStorage.removeItem(offline.KEY);fireEvent(window,new StorageEvent('storage',{key:offline.KEY}));expect(screen.getByText(/No emergency card is saved/)).toBeInTheDocument();
});
test('preparation timeout never writes a late snapshot', async () => {
 jest.useFakeTimers();
 try {
  let finish; navigator.serviceWorker.register.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  render(<OfflineEmergencyCard card={card} owner="owner@example.test"/>);
  fireEvent.click(screen.getByRole('button',{name:'Save for offline use'}));
  await act(async()=>jest.advanceTimersByTimeAsync(15000));
  expect(screen.getByRole('status')).toHaveTextContent('Could not save');
  await act(async()=>finish({update:async()=>{}}));expect(offline.read()).toBeNull();
 }finally{jest.useRealTimers();}
});
test('sign-out cancels a pending save before the component has unmounted', async () => {
 let finish;navigator.serviceWorker.register.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
 render(<OfflineEmergencyCard card={card} owner="owner@example.test"/>);
 fireEvent.click(screen.getByRole('button',{name:'Save for offline use'}));
 fireEvent(window,new Event('nabad-signout-this-tab'));
 await act(async()=>finish({update:async()=>{}}));expect(offline.read()).toBeNull();
});
test('removing a saved copy also cancels a pending replacement', async () => {
 offline.save('owner@example.test',storedCard);
 let finish;navigator.serviceWorker.register.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
 render(<OfflineEmergencyCard card={card} owner="owner@example.test"/>);
 fireEvent.click(screen.getByRole('button',{name:'Save for offline use'}));
 fireEvent.click(screen.getByRole('button',{name:'Remove offline copy'}));
 await act(async()=>finish({update:async()=>{}}));expect(offline.read()).toBeNull();
});
