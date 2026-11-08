import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccessibilityProvider } from '../context/AccessibilityContext';
import AccessibilitySettings from '../components/AccessibilitySettings';
const KEY='nabad-accessibility-preferences';
const settings=()=>render(<AccessibilityProvider><AccessibilitySettings/></AccessibilityProvider>);
beforeEach(()=>{localStorage.clear();delete document.documentElement.dataset.textSize;delete document.documentElement.dataset.highContrast;});
afterEach(()=>jest.restoreAllMocks());
test('saved low-vision preferences apply and remain keyboard-operable',async()=>{
 localStorage.setItem(KEY,JSON.stringify({textSize:'large',highContrast:true,simplifiedMode:false}));
 const user=userEvent.setup();settings();await waitFor(()=>expect(document.documentElement.dataset.textSize).toBe('large'));
 expect(screen.getByRole('checkbox',{name:'High contrast'})).toBeChecked();
 await user.selectOptions(screen.getByLabelText('Text size'),'extra-large');
 const box=screen.getByRole('checkbox',{name:'High contrast'});box.focus();await user.keyboard(' ');
 expect(box).not.toBeChecked();await waitFor(()=>expect(JSON.parse(localStorage.getItem(KEY)).textSize).toBe('extra-large'));
});
test('invalid saved values do not enable modes or corrupt CSS settings',async()=>{
 localStorage.setItem(KEY,JSON.stringify({textSize:'unrecognized',highContrast:'false',simplifiedMode:'true',secret:'ignored'}));settings();
 await waitFor(()=>expect(document.documentElement.dataset.textSize).toBe('default'));
 expect(screen.getByRole('checkbox',{name:'High contrast'})).not.toBeChecked();
 expect(JSON.parse(localStorage.getItem(KEY))).toEqual({textSize:'default',highContrast:false,simplifiedMode:false});
});
test('blocked storage leaves the controls and current-session preferences usable',async()=>{
 jest.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('blocked');});
 jest.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('blocked');});
 const user=userEvent.setup();settings();expect(await screen.findByRole('status')).toHaveTextContent("couldn't be saved");
 await user.selectOptions(screen.getByLabelText('Text size'),'extra-large');
 await user.click(screen.getByRole('checkbox',{name:'High contrast'}));
 await waitFor(()=>expect(document.documentElement.dataset.textSize).toBe('extra-large'));
 expect(document.documentElement.dataset.highContrast).toBe('true');
});
