import { expect, test } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5173';

/** Builds a minimal, standards-compliant single-page PDF containing readable text. */
function buildMinimalPdfBuffer(lines: string[]): Buffer {
  const escapedLines = lines.map((l) =>
    l.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  );
  const streamCommands = [
    'BT',
    '/F1 12 Tf',
    '50 750 Td',
    '16 TL',
    ...escapedLines.map((l, idx) => (idx === 0 ? `(${l}) Tj` : `T* (${l}) Tj`)),
    'ET',
  ].join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamCommands, 'utf8')} >>\nstream\n${streamCommands}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

test('upload MD course notes and extract what to learn + QCMs in Built-in mode', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(APP_URL);

  const courseMarkdown = `# Thermodynamics Fundamentals

## First Law of Thermodynamics
Energy Conservation: The change in internal energy of a closed system equals heat added minus work done by the system.
Thermodynamic systems exchange energy through heat transfer and mechanical work across boundaries.

## Second Law and Entropy
Entropy: A state function measuring microscopic disorder that never decreases in an isolated system.
Spontaneous heat flow always moves from a higher temperature reservoir to a lower temperature reservoir without external work.
However, entropy can decrease locally inside an open system as long as total universe entropy increases.
`;

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'thermodynamics_course.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(courseMarkdown, 'utf8'),
  });

  // Auto-detected as Course and submit button turns into Extract & Quiz Me
  await expect(page.getByText('thermodynamics_course.md')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Course', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Extract & Quiz Me' })).toBeEnabled();

  await page.getByRole('button', { name: 'Extract & Quiz Me' }).click();

  await expect(page.getByRole('heading', { name: 'What You Need to Learn' })).toBeVisible();
  await expect(page.getByText('First Law of Thermodynamics').first()).toBeVisible();
  await expect(page.getByText('Comprehension Check')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Drill' }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('parse real binary PDF exam file in browser and allow toggling Course/Exam kind', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(APP_URL);

  const pdfBuffer = buildMinimalPdfBuffer([
    'Linear Algebra Midterm Exam',
    'Exercise 1 (8 pts): Prove that the eigenvalues of a real symmetric matrix are always real.',
    'Exercise 2 (6 pts): Calculate the determinant and rank of an orthogonal projection matrix.',
    'Spectral Theorem: Every real symmetric matrix can be diagonalized by an orthogonal basis of eigenvectors.',
    'Orthogonality: Two vectors are orthogonal when their inner product equals zero.',
    'Remember that invertibility requires a non-zero determinant and full column rank.',
  ]);

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'linear_algebra_midterm_exam.pdf',
    mimeType: 'application/pdf',
    buffer: pdfBuffer,
  });

  await expect(page.getByText('linear_algebra_midterm_exam.pdf')).toBeVisible();
  await expect(page.getByText('1p')).toBeVisible();
  const kindBtn = page.getByRole('button', { name: 'Exam', exact: true });
  await expect(kindBtn).toBeVisible();

  // Toggle Exam -> Course -> Exam
  await kindBtn.click();
  await expect(page.getByRole('button', { name: 'Course', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Course', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exam', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Extract & Quiz Me' }).click();
  await expect(
    page.getByRole('heading', { name: 'What You Need to Learn for These Exercises' })
  ).toBeVisible();
  await expect(page.getByText(/Exam \/ Exercises: linear_algebra_midterm_exam\.pdf/)).toBeVisible();
  await expect(page.getByText('Comprehension Check')).toBeVisible();
  expect(errors).toEqual([]);
});

test('AI provider requests include uploaded exam & course text and studyRoadmap schema', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(APP_URL);

  // Configure API Key provider
  await page.getByRole('button', { name: 'Harness Engine settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Harness Engine' });
  await dialog.getByRole('button', { name: 'API Key', exact: true }).click();
  await dialog
    .getByPlaceholder('https://api.openai.com/v1/chat/completions')
    .fill('https://provider.test/chat');
  await dialog.getByPlaceholder('sk-...').fill('test-key');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'td_probability_exercises.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      'Exercise 1 (5 pts): Use Bayes theorem to calculate posterior probability given false positive rate 2%.\nExercise 2 (5 pts): Show that independence implies zero covariance, but the converse is false.',
      'utf8'
    ),
  });

  let capturedSystem = '';
  let capturedUser = '';
  await page.route('https://provider.test/chat', async (route) => {
    const body = route.request().postDataJSON();
    capturedSystem = body?.messages?.[0]?.content || '';
    capturedUser = body?.messages?.[1]?.content || '';
    await route.fulfill({
      json: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Probability Exam Prep: Bayes & Independence',
                studyRoadmap: [
                  {
                    topic: "Bayes' Theorem & Base-Rate Fallacy",
                    why: 'Directly required to solve Exercise 1 with the 2% false positive rate.',
                    priority: 'high',
                  },
                  {
                    topic: 'Independence vs. Zero Covariance',
                    why: 'Tested in Exercise 2; you must know counterexamples where Cov(X,Y)=0 yet X,Y are dependent.',
                    priority: 'high',
                  },
                ],
                explanation: {
                  bigPicture:
                    'Your exercises test two pillars of probability: updating beliefs with conditional evidence and distinguishing linear correlation from full statistical independence.',
                  mechanics: [
                    'Apply Bayes rule P(A|B) = P(B|A)P(A)/P(B) using the law of total probability for P(B).',
                    'Check whether joint distribution factors as P(X,Y)=P(X)P(Y) rather than relying solely on Cov(X,Y)=0.',
                  ],
                  pitfall:
                    'Assuming Cov(X,Y) = 0 implies X and Y are independent; symmetric nonlinear relations like Y = X² have zero covariance while being completely dependent.',
                  keyTerms: [
                    { term: 'Posterior Probability', definition: 'Updated probability P(A|B) after observing evidence B.' },
                  ],
                },
                questions: [
                  {
                    tag: 'Misconception',
                    prompt: 'If X is symmetric around 0 and Y = X², what is true about Cov(X, Y) and independence?',
                    options: [
                      'Cov(X, Y) = 0, yet X and Y are strongly dependent',
                      'Cov(X, Y) = 0, which proves X and Y are independent',
                      'Cov(X, Y) must be strictly positive',
                      'Covariance cannot be defined for squared variables',
                    ],
                    correctIndex: 0,
                    rationale:
                      'Covariance only detects linear relationships, so Y = X² has Cov(X,Y) = 0 even though Y is fully determined by X.',
                  },
                ],
                relatedTopics: ['Law of Total Probability', 'Conditional Expectation'],
              }),
            },
          },
        ],
      },
    });
  });

  await page.getByRole('button', { name: 'Extract & Quiz Me' }).click();
  await expect(
    page.getByRole('heading', { name: 'Probability Exam Prep: Bayes & Independence' })
  ).toBeVisible();
  await expect(page.getByText("Bayes' Theorem & Base-Rate Fallacy")).toBeVisible();
  expect(capturedSystem).toContain('studyRoadmap');
  expect(capturedSystem).toContain('EXAM / EXERCISES');
  expect(capturedUser).toContain('td_probability_exercises.txt');
  expect(capturedUser).toContain('Bayes theorem');
});
