import { expect, test } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5173';

test('tutor language settings support English, French, Arabic, and Darija+French (Arabizi & Arabic script) while keeping UI in English', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(APP_URL);

  // Default badge on PromptCanvas
  await expect(page.getByRole('button', { name: /Tutor: English/ })).toBeVisible();

  // Open Settings -> select Darija + French -> check Arabizi / Arabic script switcher
  await page.getByRole('button', { name: 'Harness Engine settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Harness Engine' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('UI stays English')).toBeVisible();

  await dialog.getByRole('button', { name: /Darija \+ French/ }).click();
  await expect(dialog.getByText('Darija Script')).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Arabizi \(Latin\)/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Arabic script/ })).toBeVisible();

  // Select Arabizi and Save
  await dialog.getByRole('button', { name: /Arabizi \(Latin\)/ }).click();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: /Tutor: Darija \+ FR \(Arabizi\)/ })).toBeVisible();

  // Start a topic and verify Darija+French (Arabizi) learning content + English UI labels
  await page.getByRole('button', { name: 'Quantum Entanglement', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'L-Intrication Quantique (Quantum Entanglement)' })
  ).toBeVisible();
  await expect(page.getByText('THE BIG PICTURE')).toBeVisible();
  await expect(page.getByText('COMPREHENSION CHECK')).toBeVisible();
  await expect(page.getByText('Darija + FR (Arabizi)')).toBeVisible();
  await expect(page.getByText(/katw9e3 melli jouj particules/)).toBeVisible();

  // Switch to Darija + French (Arabic script), reload to check persistence, and verify RTL learning content
  await page.getByRole('button', { name: 'Harness Engine settings' }).click();
  await dialog.getByRole('button', { name: /Arabic script/ }).click();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await page.reload();

  await page.getByRole('button', { name: /New session/ }).first().click();
  await expect(page.getByRole('button', { name: /Tutor: Darija \+ FR \(Arabic\)/ })).toBeVisible();
  await page.getByRole('button', { name: 'Quantum Entanglement', exact: true }).click();
  const rtlHeading = page.getByRole('heading', {
    name: /الـ Intrication Quantique/,
  });
  await expect(rtlHeading).toBeVisible();
  await expect(rtlHeading).toHaveAttribute('dir', 'rtl');
  // UI chrome remains in English LTR
  await expect(page.getByText('THE BIG PICTURE')).toBeVisible();
  await expect(page.getByText('Your path from scratch')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next Step' })).toBeVisible();

  // Test French
  await page.getByRole('button', { name: 'Harness Engine settings' }).click();
  await dialog.getByRole('button', { name: 'French', exact: true }).click();
  await expect(dialog.getByText('Darija Script')).not.toBeVisible();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: /New session/ }).first().click();
  await page.getByRole('button', { name: 'Quantum Entanglement', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'L’Intrication Quantique' })).toBeVisible();

  // Test Arabic
  await page.getByRole('button', { name: 'Harness Engine settings' }).click();
  await dialog.getByRole('button', { name: 'Arabic', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: /New session/ }).first().click();
  await page.getByRole('button', { name: 'Quantum Entanglement', exact: true }).click();
  const arHeading = page.getByRole('heading', { name: /التشابك الكمومي/ });
  await expect(arHeading).toBeVisible();
  await expect(arHeading).toHaveAttribute('dir', 'rtl');
});

test('AI provider requests include selected Darija+French language & script instruction', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(APP_URL);

  await page.getByRole('button', { name: 'Harness Engine settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Harness Engine' });
  await dialog.getByRole('button', { name: 'API Key', exact: true }).click();
  await dialog.getByPlaceholder('https://api.openai.com/v1/chat/completions').fill('https://provider.test/chat');
  await dialog.getByPlaceholder('sk-...').fill('test-key');
  await dialog.getByRole('button', { name: /Darija \+ French/ }).click();
  await dialog.getByRole('button', { name: /Arabizi \(Latin\)/ }).click();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  let capturedSystemPrompt = '';
  await page.route('https://provider.test/chat', async (route) => {
    const body = route.request().postDataJSON();
    capturedSystemPrompt = body?.messages?.[0]?.content || '';
    await route.fulfill({
      json: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'La Gravité b Darija',
                explanation: {
                  bigPicture: 'La gravité hiya l-force li katjbed les masses bjouj.',
                  mechanics: ['Kolla masse kat3wej l-espace-temps.'],
                  pitfall: 'Ma tkhlltch bin la masse w le poids.',
                  keyTerms: [{ term: 'La masse', definition: 'Kammiyat l-madda.' }],
                },
                questions: [
                  {
                    tag: 'Core Concept',
                    prompt: 'Chno kaydir la masse l l-espace-temps?',
                    options: ['Kat3wjo', 'Kat7ydo', 'Katbardo', 'Walo'],
                    correctIndex: 0,
                    rationale: 'Selon la relativité générale, la masse kat3wej l-espace-temps.',
                  },
                ],
                relatedTopics: ['La Relativité Générale'],
              }),
            },
          },
        ],
      },
    });
  });

  await page.locator('textarea').fill('Gravity');
  await page.getByRole('button', { name: 'Explain & Quiz Me', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'La Gravité b Darija' })).toBeVisible();
  expect(capturedSystemPrompt).toContain('Moroccan Darija');
  expect(capturedSystemPrompt).toContain('Arabizi');
  expect(capturedSystemPrompt).toContain('technical terms in French');
});
