/** Fired to show the in-layout celebration strip with demo copy (AdminLayout listener). */
export const CELEBRATE_BAR_TEST_EVENT = 'skcleantec:test-celebrate-bar';

export function dispatchCelebrateBarTest(): void {
  window.dispatchEvent(new CustomEvent(CELEBRATE_BAR_TEST_EVENT));
}
