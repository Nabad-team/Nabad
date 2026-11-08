import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActiveProfileProvider, useActiveProfile } from '../context/ActiveProfileContext';
import * as fake from '../test-utils/fakeProfileApi';
jest.mock('../lib/profileApi',()=>require('../test-utils/fakeProfileApi'));
jest.mock('../components/SessionTimeout',()=>({useSessionStatus:()=> 'signedIn'}));
afterEach(()=>jest.restoreAllMocks());
test('blocked browser storage does not prevent loading or switching the active profile',async()=>{
 fake.resetFakeProfiles();const child=await fake.addLinkedProfile({fullName:'Child',dateOfBirth:'2020-01-01',relationship:'child'});
 for(const method of ['getItem','setItem','removeItem'])jest.spyOn(Storage.prototype,method).mockImplementation(()=>{throw Error('blocked');});
 function Example(){const {activeProfile,switchProfile,resetActiveProfile}=useActiveProfile();return <><p>{activeProfile?.fullName}</p><button onClick={()=>switchProfile(child.id)}>Switch person</button><button onClick={resetActiveProfile}>Reset</button></>;}
 const user=userEvent.setup();render(<ActiveProfileProvider><Example/></ActiveProfileProvider>);
 await screen.findByText('Demo User');await user.click(screen.getByRole('button',{name:'Switch person'}));await screen.findByText('Child');
 await user.click(screen.getByRole('button',{name:'Reset'}));expect(screen.queryByText('Child')).not.toBeInTheDocument();
});
