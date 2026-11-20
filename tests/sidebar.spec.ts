import { expect, test, type Page } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5173';
const HISTORY_KEY = 'socratic_qcm_history_v1';

async function openApp(page: Page) {
  await page.goto(APP_URL);
  await expect(
    page.getByRole('heading', { name: 'What do you want to understand?' }),
  ).toBeVisible();
}

async function startQuantumSession(page: Page) {
  await page
    .getByRole('button', { name: 'Quantum Entanglement', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Quantum Entanglement', exact: true }),
  ).toBeVisible();
}

test('sidebar saves, searches, resumes, and remembers its collapsed state', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openApp(page);
  await expect(page.getByText('A place for your curiosity')).toBeVisible();

  await startQuantumSession(page);
  await page.keyboard.press('2');
  const navigation = page.getByRole('navigation', { name: 'Saved sessions' });
  await expect(
    navigation.getByRole('button', { name: /Quantum Entanglement/ }),
  ).toContainText('1 of 5 answered');

  await page.getByRole('button', { name: 'New session', exact: true }).click();
  await page
    .getByRole('button', { name: 'CRISPR-Cas9 Gene Editing', exact: true })
    .click();
  await expect(navigation.getByRole('button')).toHaveCount(2);
  await expect(navigation.locator('[aria-current="page"]')).toContainText(
    'CRISPR',
  );

  await navigation
    .getByRole('button', { name: /Quantum Entanglement/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Quantum Entanglement', exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Q2 of 5/)).toBeVisible();
  await expect(navigation.locator('[aria-current="page"]')).toContainText(
    'Quantum',
  );
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || '[]'),
    HISTORY_KEY,
  );
  expect(saved).toHaveLength(2);
  expect(
    Object.keys(
      saved.find(
        (item: { title: string }) => item.title === 'Quantum Entanglement',
      ).answers,
    ),
  ).toHaveLength(1);

  await page
    .getByRole('button', { name: 'Collapse sidebar', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Expand sidebar', exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      Math.round((await page.locator('#session-sidebar').boundingBox())!.width),
    )
    .toBe(64);
  await page.screenshot({ path: 'test-results/sidebar-collapsed-light.png' });
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Expand sidebar', exact: true }),
  ).toBeVisible();

  await page
    .getByRole('button', { name: 'Search session history', exact: true })
    .click();
  const search = page.getByRole('searchbox', { name: 'Search sessions' });
  await expect(search).toBeFocused();
  await search.fill('crispr');
  await expect(navigation.getByRole('button')).toHaveCount(1);
  await search.fill('not a saved topic');
  await expect(page.getByText('No matching sessions')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(navigation.getByRole('button')).toHaveCount(2);

  await page
    .getByRole('button', { name: 'Switch to dark mode', exact: true })
    .click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await navigation
    .getByRole('button', { name: /Quantum Entanglement/ })
    .click();
  await page.screenshot({
    path: 'test-results/sidebar-desktop-dark.png',
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test('history lists every saved session in date groups and confirms clearing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  await startQuantumSession(page);
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) || '[]').length,
        HISTORY_KEY,
      ),
    )
    .toBe(1);
  await page.evaluate((key) => {
    const original = JSON.parse(localStorage.getItem(key) || '[]')[0];
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const history = Array.from({ length: 20 }, (_, index) => {
      const date = new Date(today);
      date.setDate(
        date.getDate() - (index < 5 ? 0 : index < 10 ? 1 : index < 15 ? 3 : 14),
      );
      return {
        ...original,
        id: `session-${index}`,
        title: `Saved learning session ${index + 1}`,
        createdAt: date.getTime(),
        updatedAt: date.getTime(),
        session: {
          ...original.session,
          id: `session-${index}`,
          title: `Saved learning session ${index + 1}`,
        },
      };
    });
    localStorage.setItem(key, JSON.stringify(history));
  }, HISTORY_KEY);
  await page.reload();
  const navigation = page.getByRole('navigation', { name: 'Saved sessions' });
  await expect(navigation.getByRole('button')).toHaveCount(20);
  for (const group of ['Today', 'Yesterday', 'Previous 7 days', 'Older']) {
    await expect(
      navigation.getByRole('region', { name: group }),
    ).toBeAttached();
  }
  await page.screenshot({ path: 'test-results/sidebar-desktop-light.png' });
  await navigation
    .getByRole('button', { name: /Saved learning session 20/ })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Saved learning session 20',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Clear session history', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Keep sessions', exact: true })
    .click();
  await expect(navigation.getByRole('button')).toHaveCount(20);
  await page
    .getByRole('button', { name: 'Clear session history', exact: true })
    .click();
  await page.getByRole('button', { name: 'Delete all', exact: true }).click();
  await expect(page.getByText('A place for your curiosity')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'What do you want to understand?' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) || '[]').length,
      HISTORY_KEY,
    ),
  ).toBe(0);
});

test('mobile drawer traps focus, closes cleanly, and never changes the quiz underneath', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await startQuantumSession(page);
  const openButton = page.getByRole('button', {
    name: 'Open session sidebar',
    exact: true,
  });
  await openButton.click();
  const drawer = page.getByRole('dialog', { name: 'Session history' });
  await expect(drawer).toBeVisible();
  const closeButton = drawer.getByRole('button', {
    name: 'Close sidebar',
    exact: true,
  });
  await expect(closeButton).toBeFocused();
  await expect
    .poll(async () => Math.round((await drawer.boundingBox())!.x))
    .toBe(0);
  await drawer
    .getByRole('button', { name: 'Socratic home', exact: true })
    .focus();
  await page.keyboard.press('Shift+Tab');
  await expect(
    drawer.getByRole('button', { name: 'Clear session history', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    drawer.getByRole('button', { name: 'Socratic home', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('2');
  await expect(
    drawer.getByRole('button', { name: /Quantum Entanglement/ }),
  ).toContainText('Ready to continue');
  await page.screenshot({ path: 'test-results/sidebar-mobile.png' });
  await page.keyboard.press('Escape');
  await expect(drawer).not.toBeVisible();
  await expect(openButton).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    'hidden',
  );

  await openButton.click();
  await drawer.getByRole('button', { name: /Quantum Entanglement/ }).click();
  await expect(drawer).not.toBeVisible();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await openButton.click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(
    page.getByRole('button', { name: 'Collapse sidebar', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    'hidden',
  );
});

test('opening a saved session cancels stale generation results', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openApp(page);
  await startQuantumSession(page);
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) || '[]').length,
        HISTORY_KEY,
      ),
    )
    .toBe(1);
  await page.evaluate(() => {
    const settings = JSON.parse(
      localStorage.getItem('socratic_qcm_settings_v3') || '{}',
    );
    settings.activeProvider = 'openai-api';
    settings.openai = {
      endpoint: 'https://provider.test/chat',
      apiKey: 'test-key',
      model: 'test-model',
    };
    localStorage.setItem('socratic_qcm_settings_v3', JSON.stringify(settings));
  });
  await page.reload();
  let releaseResponse: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await page.route('https://provider.test/chat', async (route) => {
    await gate;
    await route.fulfill({
      json: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Delayed result',
                explanation: {},
                questions: [],
              }),
            },
          },
        ],
      },
    });
  });
  await page.locator('textarea').fill('A delayed request');
  const requested = page.waitForRequest('https://provider.test/chat');
  await page
    .getByRole('button', { name: 'Explain & Quiz Me', exact: true })
    .click();
  await requested;
  await page
    .getByRole('navigation', { name: 'Saved sessions' })
    .getByRole('button', { name: /Quantum Entanglement/ })
    .click();
  const responded = page.waitForResponse('https://provider.test/chat');
  releaseResponse();
  await responded;
  await expect(
    page.getByRole('heading', { name: 'Quantum Entanglement', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Delayed result', exact: true }),
  ).not.toBeVisible();
});
