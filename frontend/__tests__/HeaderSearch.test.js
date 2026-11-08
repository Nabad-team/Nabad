import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeaderSearch from '../components/HeaderSearch';
import { searchNabad } from '../lib/searchApi';
import { PAGE_FLOW_TIMEOUT } from '../test-utils/timeouts';
jest.setTimeout(PAGE_FLOW_TIMEOUT);
jest.mock('../lib/searchApi', () => ({ searchNabad: jest.fn() }));
const empty = () => Object.fromEntries(['pages', 'medications', 'documents', 'appointments', 'hospitals'].map(type => [type, { items: [], hasMore: false }]));
const found = () => ({ ...empty(), pages: { items: [{ label: 'Medications', href: '/medications' }], hasMore: false }, medications: { items: [{ label: 'Example medicine', href: '/medications#medication-123', detail: 'Active' }], hasMore: true }, documents: { items: [{ label: 'Example.pdf', href: '/medical-documents#document-123' }] }, appointments: { items: [{ label: 'Example visit', href: '/appointments#appointment-123' }] }, hospitals: { items: [{ label: 'Example hospital', href: '/providers/example' }] } });
const box = () => screen.getByRole('searchbox', { name: 'Search Nabad' });
beforeEach(() => { jest.resetAllMocks(); searchNabad.mockResolvedValue(found()); });

test('short text makes no requests; grouped results link to all five destinations after debouncing', async () => {
  const user = userEvent.setup(); render(<HeaderSearch profileId="self" profileName="Demo" />);
  await user.click(box()); expect(screen.getByRole('status')).toHaveTextContent('Enter at least 2');
  fireEvent.change(box(), { target: { value: 'e' } }); expect(searchNabad).not.toHaveBeenCalled();
  fireEvent.change(box(), { target: { value: 'example' } }); expect(searchNabad).not.toHaveBeenCalled();
  expect(await screen.findByRole('link', { name: 'Example medicine' })).toHaveAttribute('href', '/medications#medication-123');
  expect(searchNabad).toHaveBeenCalledWith('self', 'example', expect.any(AbortSignal));
  for (const name of ['Pages', 'Medications', 'Documents', 'Appointments', 'Hospitals']) expect(screen.getByRole('heading', { name })).toBeInTheDocument();
  expect(screen.getByText(/More matches available/)).toBeInTheDocument();
});
test('keyboard reaches links and Escape closes the results and restores focus', async () => {
  const user = userEvent.setup(); render(<HeaderSearch profileId="self" />);
  await user.type(box(), 'example'); await screen.findByRole('link', { name: 'Example medicine' });
  await user.keyboard('{ArrowDown}'); expect(screen.getByRole('link', { name: 'Medications' })).toHaveFocus();
  await user.keyboard('{Escape}'); expect(screen.queryByRole('region', { name: 'Search results' })).not.toBeInTheDocument(); expect(box()).toHaveFocus();
  await user.click(box()); await screen.findByRole('region', { name: 'Search results' });
  await user.click(screen.getByRole('button', { name: 'Search' }));
  fireEvent.mouseDown(document.body); expect(screen.queryByRole('region', { name: 'Search results' })).not.toBeInTheDocument();
});
test('empty states, retry and clearing are explicit and never claim a failed search has no matches', async () => {
  searchNabad.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(empty());
  const user = userEvent.setup(); render(<HeaderSearch profileId="self" />);
  await user.type(box(), 'nothing'); expect(await screen.findByRole('alert')).toHaveTextContent('Search is unavailable');
  expect(screen.queryByText(/No results found/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Retry search' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Searching');
  await screen.findByText(/No results found/);
  await user.click(screen.getByRole('button', { name: 'Clear search' })); expect(box()).toHaveValue(''); expect(box()).toHaveFocus();
  expect(screen.queryByText(/No results found/)).not.toBeInTheDocument();
});
test('slow old responses cannot replace the latest query', async () => {
  let finishOld;
  searchNabad.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValue(empty());
  render(<HeaderSearch profileId="self" />); fireEvent.focus(box()); fireEvent.change(box(), { target: { value: 'older' } });
  await waitFor(() => expect(searchNabad).toHaveBeenCalledTimes(1)); const signal = searchNabad.mock.calls[0][2];
  fireEvent.change(box(), { target: { value: 'newer' } }); expect(signal.aborted).toBe(true);
  await screen.findByText(/No results found/);
  await act(async () => finishOld(found()));
  expect(screen.queryByRole('link', { name: 'Example medicine' })).not.toBeInTheDocument();
});
test('switching profile clears the query/results and cancels in-flight work', async () => {
  const view = render(<HeaderSearch key="self" profileId="self" profileName="Owner" />);
  fireEvent.focus(box()); fireEvent.change(box(), { target: { value: 'example' } });
  await screen.findByRole('link', { name: 'Example medicine' }); const signal = searchNabad.mock.calls[0][2];
  view.rerender(<HeaderSearch key="child" profileId="child" profileName="Child" />);
  expect(signal.aborted).toBe(true); expect(box()).toHaveValue(''); expect(screen.queryByRole('link', { name: 'Example medicine' })).not.toBeInTheDocument();
  fireEvent.focus(box()); fireEvent.change(box(), { target: { value: 'example' } });
  await waitFor(() => expect(searchNabad).toHaveBeenLastCalledWith('child', 'example', expect.any(AbortSignal)));
  expect(within(screen.getByRole('region', { name: 'Search results' })).getByText(/Records for Child/)).toBeInTheDocument();
});
test('unmounting cancels pending searches and submission does not put text in the URL', async () => {
  const user = userEvent.setup(); const view = render(<HeaderSearch profileId="self" />);
  const location = window.location.href;
  await user.type(box(), 'example'); await screen.findByRole('link', { name: 'Example medicine' });
  await user.click(screen.getByRole('button', { name: 'Search' })); expect(window.location.href).toBe(location);
  await waitFor(() => expect(searchNabad).toHaveBeenCalledTimes(2));
  const signal = searchNabad.mock.calls[1][2]; view.unmount(); expect(signal.aborted).toBe(true);
});
