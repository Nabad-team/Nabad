import { render, screen, act } from '@testing-library/react';
import useSearchTarget from '../lib/useSearchTarget';
const id = '0123456789abcdef01234567';
function Example({ items = [] }) {
  useSearchTarget(items, 'medication');
  return <details><summary>Discontinued</summary>{items.map(item => <div key={item} id={`medication-${item}`} tabIndex={-1}>Saved record</div>)}</details>;
}
afterEach(() => window.history.replaceState({}, '', '/'));
test('after loading, a deep link reveals archived records and focuses the matching item', () => {
  window.history.replaceState({}, '', `/medications#medication-${id}`);
  const view = render(<Example />); expect(document.querySelector('details')).not.toHaveAttribute('open');
  view.rerender(<Example items={[id]} />);
  expect(document.querySelector('details')).toHaveAttribute('open'); expect(screen.getByText('Saved record')).toHaveFocus();
});
test('untrusted or missing fragment targets do not open unrelated records', () => {
  window.history.replaceState({}, '', '/medications#medication-bad'); render(<Example items={[id]} />);
  expect(document.querySelector('details')).not.toHaveAttribute('open');
});
test('hash navigation works after the page has already loaded', () => {
  render(<Example items={[id]} />);
  window.history.replaceState({}, '', `/medications#medication-${id}`);
  act(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
  expect(screen.getByText('Saved record')).toHaveFocus();
});
