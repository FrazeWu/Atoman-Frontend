/**
 * 《Analyzing Quantitative Data: From Description to Explanation》
 * 作者：Norman Blaikie
 * 出版社：SAGE Publications (London • Thousand Oaks • New Delhi)
 * 2003 年初版
 */

export interface ChapterSection {
  id: string
  title: string
  content: string[]
  table?: {
    title: string
    headers: string[]
    rows: (string | number)[][]
  }
}

export interface BookChapter {
  id: string
  chapterNumber?: number | string
  title: string
  pageNumber: number
  sections: ChapterSection[]
}

export interface AcademicBook {
  title: string
  subtitle: string
  author: string
  publisher: string
  publishedYear: string
  isbn: string
  coverTag: string
  summary: string
  toc: { href: string; label: string; depth: number; page: number }[]
  chapters: BookChapter[]
}

export const analyzingQuantitativeDataBook: AcademicBook = {
  title: 'Analyzing Quantitative Data',
  subtitle: 'From Description to Explanation',
  author: 'Norman Blaikie',
  publisher: 'SAGE Publications',
  publishedYear: '2003',
  isbn: '0 7619 6758 3',
  coverTag: '量化方法 / 社会科学研究',
  summary: 'This book is about how to use quantitative data to answer research questions in social research. It deals with the methods essential for quantitative social research from description to explanation.',
  
  // 详尽目录树
  toc: [
    { href: '#intro', label: 'Introduction: About the Book', depth: 0, page: 1 },
    { href: '#intro-why', label: 'Why was it written?', depth: 1, page: 1 },
    { href: '#intro-who', label: 'Who is it for?', depth: 1, page: 3 },
    { href: '#intro-different', label: 'What makes it different?', depth: 1, page: 4 },
    { href: '#intro-controversial', label: 'What are the controversial issues?', depth: 1, page: 6 },
    { href: '#intro-how-to-read', label: 'What is the best way to read this book?', depth: 1, page: 7 },
    { href: '#intro-cope', label: 'What is needed to cope with it?', depth: 1, page: 8 },
    { href: '#ch1', label: '1. Social Research and Data Analysis: Demystifying Basic Concepts', depth: 0, page: 10 },
    { href: '#ch1-purpose', label: 'What is the purpose of social research?', depth: 1, page: 10 },
    { href: '#ch1-problem', label: 'The research problem', depth: 1, page: 11 },
    { href: '#ch1-objectives', label: 'Research objectives', depth: 1, page: 11 },
    { href: '#ch1-questions', label: 'Research questions', depth: 1, page: 13 },
    { href: '#ch1-hypotheses', label: 'The role of hypotheses', depth: 1, page: 13 },
    { href: '#ch1-data', label: 'What are data?', depth: 1, page: 15 },
    { href: '#ch1-reality', label: 'Data and social reality', depth: 1, page: 16 },
    { href: '#ch1-types', label: 'Types of data', depth: 1, page: 17 },
    { href: '#ch1-forms', label: 'Forms of data', depth: 1, page: 20 },
    { href: '#ch1-concepts', label: 'Concepts and variables', depth: 1, page: 22 },
    { href: '#ch1-levels', label: 'Levels of measurement', depth: 1, page: 22 },
    { href: '#ch1-analysis', label: 'What is data analysis?', depth: 1, page: 28 },
    { href: '#ch1-types-analysis', label: 'Types of analysis', depth: 1, page: 29 },
    { href: '#ch2', label: '2. Data Analysis in Context: Working with Two Data Sets', depth: 0, page: 37 },
    { href: '#ch3', label: '3. Descriptive Analysis – Univariate: Looking for Characteristics', depth: 0, page: 47 },
    { href: '#ch4', label: '4. Descriptive Analysis – Bivariate: Looking for Patterns', depth: 0, page: 89 },
    { href: '#ch5', label: '5. Explanatory Analysis: Looking for Influences', depth: 0, page: 116 },
    { href: '#ch6', label: '6. Inferential Analysis: From Sample to Population', depth: 0, page: 159 },
    { href: '#ch7', label: '7. Data Reduction: Preparing to Answer Research Questions', depth: 0, page: 214 },
    { href: '#ch8', label: '8. Real Data Analysis: Answering Research Questions', depth: 0, page: 249 },
    { href: '#glossary', label: 'Glossary', depth: 0, page: 306 },
    { href: '#app-a', label: 'Appendix A: Symbols', depth: 0, page: 324 },
    { href: '#app-b', label: 'Appendix B: Equations', depth: 0, page: 326 },
    { href: '#app-c', label: 'Appendix C: SPSS Procedures', depth: 0, page: 333 },
    { href: '#app-d', label: 'Appendix D: Statistical Tables', depth: 0, page: 339 },
    { href: '#references', label: 'References', depth: 0, page: 344 },
    { href: '#index', label: 'Index', depth: 0, page: 347 },
    { href: '#summary-chart', label: 'Summary Chart of Methods', depth: 0, page: 353 },
  ],

  // 章节精校正文
  chapters: [
    {
      id: 'intro',
      chapterNumber: 'Intro',
      title: 'Introduction: About the Book',
      pageNumber: 1,
      sections: [
        {
          id: 'intro-about',
          title: 'About the Book',
          content: [
            'This book is about how to use quantitative data to answer research questions in social research. It is about how to analyze data in the form of a set of variables that have been measured on a collection of individuals or that have been collected about some aspects of social life.',
            'This is not a book on statistics, although it covers an array of statistical procedures. It is not a book on research methods, although it deals with some of the methods essential for quantitative social research. It is not a book on how to use statistical software packages, although it refers to such procedures.',
          ],
        },
        {
          id: 'intro-why',
          title: 'Why was it Written?',
          content: [
            'This is not a book I ever imagined writing. My first reaction when asked to write it was: "Why do we need another book on statistics or data analysis? Hasn\'t it all been said already?" Perhaps the reason why so many books continue to be written in this field is that their authors think they can make an improvement to the way students are introduced to a course that most find excruciatingly difficult.',
            'However, the challenge that I was given, and which got me hooked, was to be iconoclastic. I interpreted this to include: challenging unhelpful content and structure that have been taken for granted in successive volumes in the field; being critical of practices that have been perpetuated without having any obvious use to a researcher; and, more particularly, exposing the misuses of certain procedures.',
            'Like Merton (1968) and Mills (1959), I have been very critical of some forms of mindless empiricism as well as the use of highly sophisticated research techniques that create great gulfs between the researcher and the social reality that is being studied. However, in spite of this, I believe that quantitative data analysis is important for certain purposes. The trick is to know which methods to use in which context and for which purpose.',
          ],
        },
        {
          id: 'intro-who',
          title: 'Who is it for?',
          content: [
            'Analyzing Quantitative Data is intended for students in the social sciences. It is designed to meet the needs of average undergraduate and most postgraduate students, and to do this in a way that relates directly to the business of doing social research.',
            'I suspect some of my readers will suffer from the common malady of "symbol phobia". Presented with a simple equation, such as a + b = c, your eyes will glaze over. Or perhaps, like the well-known Indian writer, R.K. Narayan, you suffer from what he called "figure-blindness".',
            'Well, this book contains symbols, but only very basic ones, and requires competence in basic arithmetic. Many of the conventions used in statistics texts are avoided, often by expressing symbols in words.',
          ],
        },
        {
          id: 'intro-different',
          title: 'What Makes it Different?',
          content: [
            'First, two classification schemes are used to organize the discussion of the many methods of data analysis: the type of analysis (univariate description, bivariate description, explanation and inference), and the level of measurement (categorical: nominal/ordinal; metric: interval/ratio).',
            'Second, all the methods of analysis are illustrated and discussed in the context of a real research problem (environmental worldviews and behaviour in Melbourne). The whole book simulates the kind of considerations social researchers face.',
            'Third, the nature of data, particularly quantitative data, is discussed rather than being taken for granted, addressing ontological and epistemological assumptions.',
            'Fourth, it combines data analysis with substantive interpretation of the results.',
            'Fifth, this is a software-free textbook. It focuses on the principles behind procedures and their purposes, rather than getting lost in software menus.',
          ],
        },
        {
          id: 'intro-controversial',
          title: 'What are the Controversial Issues?',
          content: [
            'The following icons of social research are challenged in this book:',
            '1. That social research must begin with one or more hypotheses (many research objectives only require research questions).',
            '2. That tests of significance are an essential feature of data analysis (they are often misused when not dealing with probability samples).',
            '3. That measures of association provide explanations (correlation does not imply causation).',
          ],
        },
      ],
    },
    {
      id: 'ch1',
      chapterNumber: 1,
      title: 'Social Research and Data Analysis: Demystifying Basic Concepts',
      pageNumber: 10,
      sections: [
        {
          id: 'ch1-intro',
          title: 'Introduction',
          content: [
            'This book is about the analysis of certain kinds of data, that is, only quantitative data. We need to begin by discussing the three concepts that make up the main title of this book: data, quantitative, and analysis.',
            'This chapter deals with three fundamental questions: What is the purpose of social research? What are data? What is data analysis?',
          ],
        },
        {
          id: 'ch1-purpose',
          title: 'What is the Purpose of Social Research?',
          content: [
            'The aim of all scientific disciplines is to advance knowledge in their field, to provide new or better understanding of certain phenomena, to solve intellectual puzzles and/or to solve practical problems.',
            'Critical issues include: What constitutes scientific knowledge? How does it differ from other forms of knowledge? How do we judge the status of this knowledge? How do we produce new knowledge or improve existing knowledge?',
          ],
        },
        {
          id: 'ch1-objectives',
          title: 'Research Objectives and Questions',
          content: [
            'Social research can pursue many objectives: to explore, describe, understand, explain, predict, change, evaluate or assess aspects of social phenomena.',
            'Research questions fall into three main types: "what" questions (seek descriptive answers), "why" questions (seek understanding or explanation), and "how" questions (seek appropriate interventions to bring about change).',
          ],
          table: {
            title: 'Table 1.1 Research questions and objectives',
            headers: ['Research objectives', 'What', 'Why', 'How'],
            rows: [
              ['Exploration', '✓', '', ''],
              ['Description', '✓', '', ''],
              ['Explanation', '', '✓', ''],
              ['Understanding', '', '✓', ''],
              ['Prediction', '✓', '', ''],
              ['Intervention', '', '', '✓'],
              ['Evaluation', '✓', '✓', ''],
              ['Assess impacts', '✓', '✓', ''],
            ],
          },
        },
        {
          id: 'ch1-data',
          title: 'What are Data and Levels of Measurement?',
          content: [
            'In quantitative research, aspects of social reality are transformed into numbers. Measurement is achieved either by assignment to discrete categories (categorical: nominal and ordinal) or onto a numerical scale (metric: interval and ratio).',
            'Nominal-level measurement classifies objects into homogeneous, mutually exclusive and exhaustive categories without intrinsic order (e.g. religion, gender).',
            'Ordinal-level measurement ranks categories along a continuum (e.g. social class, Likert agreement scales), but intervals between categories are not necessarily equal.',
            'Interval-level measurement features equal distances between scale points, but the zero point is arbitrary (e.g. Celsius temperature, attitude scales).',
            'Ratio-level measurement possesses an absolute or true zero (e.g. age in years, income in dollars, number of children).',
          ],
          table: {
            title: 'Table 1.2 Levels of measurement',
            headers: ['Level', 'Description', 'Types of categories', 'Examples'],
            rows: [
              ['Nominal', 'Classification with no assumptions about order', 'Homogeneous, mutually exclusive and exhaustive', 'Marital status, Religion, Ethnicity'],
              ['Ordinal', 'Categories ordered from highest to lowest', 'Lie along a continuum; distances not assumed equal', 'Frequency (often, sometimes, never), Likert scale'],
              ['Interval', 'Ordered and equal-interval categories on a contrived scale', 'Discrete or continuous with arbitrary zero point', 'Attitude score, IQ score, Celsius scale'],
              ['Ratio', 'Equal-interval scale with an absolute zero', 'Discrete or continuous with an absolute zero', 'Age, Income, Number of children'],
            ],
          },
        },
      ],
    },
  ],
}
