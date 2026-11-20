import { expect, test } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5173';

test('built-in session builds a from-scratch staged path with global progress', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(APP_URL);
  await page.getByRole('button', { name: 'Quantum Entanglement', exact: true }).click();

  // Session title stays as the main heading; the path starts at step 1.
  await expect(
    page.getByRole('heading', { name: 'Quantum Entanglement', exact: true })
  ).toBeVisible();
  await expect(page.getByText('Your path from scratch')).toBeVisible();
  await expect(page.getByText('Step 1 of 3')).toBeVisible();
  await expect(page.getByText('Q1 of 5')).toBeVisible();

  const path = page.getByRole('navigation', { name: 'Learning path' });
  await expect(path.getByRole('button')).toHaveCount(3);
  await expect(path.getByRole('button').first()).toHaveAttribute('aria-current', 'step');

  // Answer the two step-1 questions, then continue to step 2 from the summary.
  await page.keyboard.press('1');
  await page.getByRole('button', { name: 'Next Question' }).click();
  await page.keyboard.press('2');
  await page.getByRole('button', { name: 'View Mastery Summary' }).click();
  await expect(page.getByText('Step 1 of 3 complete')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Step 2' }).click();

  await expect(page.getByText('Step 2 of 3')).toBeVisible();
  await expect(page.getByText('Q3 of 5')).toBeVisible();
  expect(errors).toEqual([]);
});

test('AI chooses stage count and per-question option counts (2–6)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(APP_URL);

  await page.getByRole('button', { name: 'Harness Engine settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Harness Engine' });
  await dialog.getByRole('button', { name: 'API Key', exact: true }).click();
  await dialog
    .getByPlaceholder('https://api.openai.com/v1/chat/completions')
    .fill('https://provider.test/chat');
  await dialog.getByPlaceholder('sk-...').fill('test-key');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  let capturedSystem = '';
  await page.route('https://provider.test/chat', async (route) => {
    const body = route.request().postDataJSON();
    capturedSystem = body?.messages?.[0]?.content || '';
    await route.fulfill({
      json: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Complex Numbers',
                stages: [
                  {
                    title: 'What Numbers Are',
                    goal: 'Say what counting numbers mean.',
                    explanation: {
                      bigPicture: 'Numbers are names for amounts you can count on your fingers.',
                      mechanics: ['Start at zero and add one repeatedly.'],
                      pitfall: 'Zero is a real number, not "nothing to learn".',
                      keyTerms: [{ term: 'Natural number', definition: 'A counting number: 1, 2, 3…' }],
                    },
                    questions: [
                      {
                        tag: 'Core Concept',
                        prompt: 'Is zero a number you can use in arithmetic?',
                        options: ['Yes, zero is a valid number', 'No, zero means the absence of numbers'],
                        correctIndex: 0,
                        rationale: 'Zero participates in addition and subtraction like any integer.',
                      },
                    ],
                  },
                  {
                    title: 'Adding and Opposites',
                    goal: 'Add numbers and undo addition with opposites.',
                    explanation: {
                      bigPicture: 'Addition combines amounts; every number has an opposite that undoes it.',
                      mechanics: ['a + b shifts a forward by b.', 'a + (-a) always returns to 0.'],
                      pitfall: 'Subtracting is adding the opposite, not a separate magic rule.',
                      keyTerms: [{ term: 'Additive inverse', definition: 'The opposite that sums to zero.' }],
                    },
                    questions: [
                      {
                        tag: 'Mechanism',
                        prompt: 'Which expression always equals zero?',
                        options: ['a + (-a)', 'a - a + 1', 'a + a', '0 - a + a + 2', 'a · 0 + 3'],
                        correctIndex: 0,
                        rationale: 'By definition of the additive inverse, a + (-a) = 0.',
                      },
                      {
                        tag: 'Application',
                        prompt: 'You owe 5 coins, then earn 8. What is your balance?',
                        options: ['+3 coins', '-3 coins', '+13 coins'],
                        correctIndex: 0,
                        rationale: '-5 + 8 = +3.',
                      },
                    ],
                  },
                  {
                    title: 'The Imaginary Unit',
                    goal: 'Use i to solve x² = -1.',
                    explanation: {
                      bigPicture: 'No real number squares to -1, so mathematicians defined i with i² = -1.',
                      mechanics: ['Treat i like a 90° rotation of the number line.'],
                      pitfall: 'i is not "imaginary" in the sense of fake; it follows strict rules.',
                      keyTerms: [{ term: 'Imaginary unit', definition: 'The number i with i² = -1.' }],
                    },
                    questions: [
                      {
                        tag: 'Core Concept',
                        prompt: 'What is i²?',
                        options: ['-1', '1', '0', 'i'],
                        correctIndex: 0,
                        rationale: 'By definition of the imaginary unit.',
                      },
                    ],
                  },
                ],
                relatedTopics: ['Argand Plane'],
              }),
            },
          },
        ],
      },
    });
  });

  await page.locator('textarea').fill('Complex numbers');
  await page.getByRole('button', { name: 'Explain & Quiz Me', exact: true }).click();

  // Prompt instructs from-scratch staging + AI-chosen option counts.
  expect(capturedSystem).toContain('FROM-SCRATCH PATH RULES');
  expect(capturedSystem).toContain('VARIABLE ANSWER-COUNT RULES');

  // Step 1: binary 2-option question.
  await expect(page.getByRole('heading', { name: 'Complex Numbers' })).toBeVisible();
  await expect(page.getByText('Step 1 of 3')).toBeVisible();
  await expect(page.getByText('Q1 of 4')).toBeVisible();
  await expect(page.getByTestId('qcm-option')).toHaveCount(2);

  // Step 2: 5-option then 3-option questions.
  const path = page.getByRole('navigation', { name: 'Learning path' });
  await path.getByRole('button', { name: /Adding and Opposites/ }).click();
  await expect(page.getByText('Step 2 of 3')).toBeVisible();
  await expect(page.getByText('Q2 of 4')).toBeVisible();
  await expect(page.getByTestId('qcm-option')).toHaveCount(5);
  // 5th option is keyboard-reachable.
  await page.keyboard.press('5');
  await expect(page.getByText(/is correct/)).toBeVisible();
  await page.getByRole('button', { name: 'Next Question' }).click();
  await expect(page.getByTestId('qcm-option')).toHaveCount(3);

  // Step 3: standard 4-option question, global numbering holds.
  await path.getByRole('button', { name: /The Imaginary Unit/ }).click();
  await expect(page.getByText('Q4 of 4')).toBeVisible();
  await expect(page.getByTestId('qcm-option')).toHaveCount(4);
});
