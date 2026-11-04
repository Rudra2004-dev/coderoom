import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Case = [input: string, output: string, hidden: boolean];

const fizz = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const k = i + 1;
    return k % 15 === 0 ? "FizzBuzz" : k % 3 === 0 ? "Fizz" : k % 5 === 0 ? "Buzz" : String(k);
  }).join("\n");

const QUESTIONS: {
  slug: string;
  title: string;
  difficulty: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  cases: Case[];
}[] = [
  {
    slug: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    description:
      "Given an array of integers and a target, find the two different positions whose values add up to the target. Exactly one answer exists.",
    inputFormat: "Line 1: the array, space separated\nLine 2: the target",
    outputFormat: "The two indices, smaller first, separated by a space",
    cases: [
      ["2 7 11 15\n9\n", "0 1", false],
      ["3 2 4\n6\n", "1 2", false],
      ["3 3\n6\n", "0 1", false],
      ["1 5 3 8 12\n20\n", "3 4", true],
      ["-1 -2 -3 -4 -5\n-8\n", "2 4", true],
      ["0 4 3 0\n0\n", "0 3", true],
    ],
  },
  {
    slug: "fizzbuzz",
    title: "FizzBuzz",
    difficulty: "Easy",
    description:
      "For every number from 1 to n, print Fizz if it is divisible by 3, Buzz if divisible by 5, FizzBuzz if divisible by both, otherwise the number itself.",
    inputFormat: "A single integer n",
    outputFormat: "n lines, one per number",
    cases: [
      ["5\n", fizz(5), false],
      ["15\n", fizz(15), false],
      ["1\n", fizz(1), true],
      ["3\n", fizz(3), true],
      ["20\n", fizz(20), true],
    ],
  },
  {
    slug: "valid-palindrome",
    title: "Valid Palindrome",
    difficulty: "Easy",
    description:
      "Decide whether a line of text reads the same forwards and backwards. Ignore case and ignore everything that is not a letter or digit.",
    inputFormat: "A single line of text",
    outputFormat: "true or false",
    cases: [
      ["racecar\n", "true", false],
      ["hello\n", "false", false],
      ["A man, a plan, a canal: Panama\n", "true", false],
      ["No lemon, no melon\n", "true", true],
      ["ab\n", "false", true],
      ["a\n", "true", true],
      ["0P\n", "false", true],
    ],
  },
  {
    slug: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Medium",
    description:
      "A line contains only the characters ( ) [ ] { }. It is valid if every bracket is closed by the same type of bracket, in the correct order.",
    inputFormat: "A single line of brackets",
    outputFormat: "true or false",
    cases: [
      ["()\n", "true", false],
      ["()[]{}\n", "true", false],
      ["(]\n", "false", false],
      ["([)]\n", "false", true],
      ["{[]}\n", "true", true],
      ["(((\n", "false", true],
      [")(\n", "false", true],
    ],
  },
  {
    slug: "reverse-words",
    title: "Reverse Words",
    difficulty: "Easy",
    description:
      "Reverse the order of the words in a line. Words are separated by one or more spaces. The result has single spaces and no leading or trailing spaces.",
    inputFormat: "A single line of text",
    outputFormat: "The words in reverse order, separated by one space",
    cases: [
      ["the sky is blue\n", "blue is sky the", false],
      ["hello world\n", "world hello", false],
      ["a good   example\n", "example good a", true],
      ["single\n", "single", true],
      ["  leading and trailing  \n", "trailing and leading", true],
    ],
  },
];

async function main() {
  for (const [position, q] of QUESTIONS.entries()) {
    const { cases, ...data } = q;
    const saved = await prisma.question.upsert({
      where: { slug: data.slug },
      update: { ...data, position },
      create: { ...data, position },
    });
    await prisma.testCase.deleteMany({ where: { questionId: saved.id } });
    await prisma.testCase.createMany({
      data: cases.map(([input, expectedOutput, isHidden], order) => ({
        questionId: saved.id,
        input,
        expectedOutput,
        isHidden,
        order,
      })),
    });
    console.log(`seeded ${data.title} (${cases.length} cases)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());