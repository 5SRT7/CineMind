import { createChatCompletion } from "./provider";
import type { MovieDetails, StructuredQuery } from "../types";
import { safeJsonParse } from "../utils";

const EMPTY_STRUCTURED: StructuredQuery = {
  reference_movies: [],
  reference_ids: [],
  genres: [],
  filter_genres: [],
  moods: [],
  styles: [],
  themes: [],
  countries: [],
  languages: [],
  year_min: null,
  year_max: null,
  certifications: [],
  notes: "",
  exclude: [],
  free_text: "",
};

const GENRE_TERMS: Record<string, string[]> = {
  horror: ["恐怖", "horror", "惊悚", "thriller", "吓人", "creepy"],
  thriller: ["惊悚", "thriller", "悬疑", "suspense", "紧张", "tense"],
  mystery: ["悬疑", "mystery", "谜", "mysterious"],
  drama: ["剧情", "drama", "文艺", "art house", "人物"],
  crime: ["犯罪", "crime", "黑帮", "gangster", "警匪"],
  romance: ["爱情", "romance", "恋爱", "romantic"],
  comedy: ["喜剧", "comedy", "搞笑", "funny"],
  "science fiction": ["科幻", "science fiction", "sci-fi", "未来", "space"],
  fantasy: ["奇幻", "fantasy", "魔法", "magic"],
  animation: ["动画", "animation", "anime", "动画片"],
  action: ["动作", "action", "打斗", "火爆"],
  "neo-noir": ["黑色电影", "neo noir", "noir", "霓虹", "neon"],
};

const MOOD_TERMS: Record<string, string[]> = {
  压抑: ["压抑", "oppressive", "suffocating", "窒息", "沉闷", "dark", "psychological", "gothic", "despair", "disturbing", "isolating"],
  黑暗: ["黑暗", "dark", "black", "阴郁", "灰暗"],
  疯狂: ["疯狂", "crazy", "insane", "madness", "发疯", "疯癫", "psychological", "obsessive", "surreal", "identity crisis", "psycho"],
  缓慢: ["慢节奏", "slow burn", "缓慢", "克制", "沉稳", "slower"],
  紧张: ["紧张", "tense", "悬疑感", "不安", "uneasy", "焦虑"],
  绝望: ["绝望", "despair", "绝望感", "hopeless", "崩溃"],
  孤独: ["孤独", "lonely", "loneliness", "isolated", "孤立"],
  悲伤: ["悲伤", "sad", "melancholic", "忧伤", "忧郁", "难过"],
  神秘: ["神秘", "mysterious", "不可知", "谜团", "enigmatic"],
  温暖: ["温暖", "warm", "治愈", "温柔", "tender", "quiet"],
  暴力: ["暴力", "violent", "brutal", "残酷", "血腥"],
  诡异: ["诡异", "uncanny", "weird", "怪诞", "disturbing", "unsettling"],
};

const STYLE_TERMS: Record<string, string[]> = {
  实验: ["实验", "experimental", "先锋", "avant", "非传统", "surreal", "dreamlike", "avant-garde", "non-linear"],
  超现实: ["超现实", "surreal", "梦境", "dreamlike", "荒诞"],
  现实主义: ["现实", "realism", "写实", "realistic", "朴素"],
  心理: ["心理", "psychological", "精神", "psycho", "内心"],
  犯罪: ["犯罪", "crime", "黑帮", "gangster"],
  社会: ["社会", "social", "阶级", "class", "现实批判"],
  类型片: ["类型片", "genre", "类型化"],
  复古: ["复古", "retro", "怀旧", "vintage", "80s"],
  极简: ["极简", "minimal", "克制", "冷峻", "sparse"],
};

const THEME_TERMS: Record<string, string[]> = {
  身份: ["身份", "identity", "自我", "谁", "双重人格"],
  复仇: ["复仇", "revenge", "报仇", "vengeance"],
  阶级: ["阶级", "class", "贫富", "阶层", "财富"],
  精神崩溃: ["精神崩溃", "mental breakdown", "崩溃", "疯掉", "失常"],
  执念: ["执念", "obsession", "痴迷", "完美主义", "偏执"],
  孤独: ["孤独", "loneliness", "孤单", "isolated", "alienation"],
  救赎: ["救赎", "redemption", "赎罪", "原谅"],
  成长: ["成长", "coming of age", "青春", "长大"],
  记忆: ["记忆", "memory", "遗忘", "回忆", "过去"],
  爱情: ["爱情", "love", "恋爱", "relationship"],
  生存: ["生存", "survival", "活下去", "求生"],
  家庭: ["家庭", "family", "亲情", "家人"],
  暴力: ["暴力", "violence", "血", "残酷"],
};

const COUNTRY_TERMS: Record<string, string[]> = {
  "韩国": ["韩国", "korea", "korean", "韩国电影"],
  "日本": ["日本", "japan", "japanese", "日本电影"],
  "中国": ["中国", "china", "chinese", "香港", "台湾", "华语"],
  "美国": ["美国", "america", "american", "好莱坞", "hollywood"],
  "英国": ["英国", "britain", "british", "uk", "england"],
  "法国": ["法国", "france", "french"],
  "德国": ["德国", "germany", "german"],
  "西班牙": ["西班牙", "spain", "spanish"],
  "俄罗斯": ["俄罗斯", "russia", "russian"],
  "印度": ["印度", "india", "indian"],
};

const LANGUAGE_TERMS: Record<string, string[]> = {
  ko: ["韩语", "韩国语", "korean", "韩国"],
  ja: ["日语", "日文", "japanese", "日本"],
  zh: ["中文", "华语", "普通话", "chinese", "粤语"],
  en: ["英语", "英文", "english", "美国", "英国"],
  fr: ["法语", "french", "法国"],
};

export function termAliases(term: string) {
  return [
    term,
    ...(MOOD_TERMS[term] ?? []),
    ...(STYLE_TERMS[term] ?? []),
    ...(THEME_TERMS[term] ?? []),
  ].filter(Boolean);
}

function extractReferences(query: string) {
  const references: string[] = [];
  const patterns = [
    /《([^》]+)》/g,
    /「([^」]+)」/g,
    /["']([^"']+)["']/g,
    /(?:类似|像|比如|参考|模仿)\s*([\u4e00-\u9fffA-Za-z0-9 :·-]{1,40})/g,
  ];
  for (const pattern of patterns) {
    for (const match of query.matchAll(pattern)) {
      const value = match[1].trim();
      if (value && !references.includes(value)) references.push(value);
    }
  }
  return references;
}

function collectMatches(query: string, dictionary: Record<string, string[]>) {
  const lower = query.toLowerCase();
  const hits: string[] = [];
  for (const [label, terms] of Object.entries(dictionary)) {
    if (terms.some((term) => lower.includes(term))) hits.push(label);
  }
  return hits;
}

function parseYears(query: string) {
  const matches = [...query.matchAll(/(\d{4})/g)].map((match) => Number(match[1]));
  if (matches.length === 0) return { year_min: null, year_max: null };
  return {
    year_min: Math.min(...matches),
    year_max: Math.max(...matches),
  };
}

export function parseQueryLocally(query: string): StructuredQuery {
  const reference_movies = extractReferences(query);
  const genres = collectMatches(query, GENRE_TERMS);
  const moods = collectMatches(query, MOOD_TERMS);
  const styles = collectMatches(query, STYLE_TERMS);
  const themes = collectMatches(query, THEME_TERMS);
  const countries = collectMatches(query, COUNTRY_TERMS);
  const languages = collectMatches(query, LANGUAGE_TERMS);
  const years = parseYears(query);

  let exclude: string[] = [];
  const exclusionMatch = query.match(/(?:不要|除了|排除|别推荐|avoid|excluding)[^。；;\n]*/i);
  if (exclusionMatch) {
    exclude = exclusionMatch[0]
      .replace(/^(不要|除了|排除|别推荐|avoid|excluding)\s*/i, "")
      .split(/[,，、和及与\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return {
    ...EMPTY_STRUCTURED,
    reference_movies: [...new Set(reference_movies)],
    genres: [...new Set(genres)],
    moods: [...new Set(moods)],
    styles: [...new Set(styles)],
    themes: [...new Set(themes)],
    countries: [...new Set(countries)],
    languages: [...new Set(languages)],
    year_min: years.year_min,
    year_max: years.year_max,
    exclude,
    free_text: query,
  };
}

async function parseWithLlm(query: string): Promise<StructuredQuery | null> {
  const prompt = `你是电影搜索系统的查询理解模块。用户会用中文自然语言描述想看的电影。
请把需求解析成 JSON，字段如下（允许为空数组或 null，不要编造）：
{
  "reference_movies": ["用户提到的参考电影标题"],
  "genres": ["Drama", "Thriller"],
  "moods": ["dark", "oppressive"],
  "styles": ["experimental", "psychological"],
  "themes": ["obsession", "identity"],
  "countries": ["韩国", "日本"],
  "languages": ["ko", "ja"],
  "year_min": null,
  "year_max": null,
  "exclude": ["商业大片"],
  "free_text": "保留原始查询"
}
规则：
1. 参考电影必须从用户原话提取，不额外联想。
2. genres 使用 TMDB 风格英文类型名；countries 使用中文地区名；languages 使用 ISO 639-1 代码。
3. moods/styles/themes 使用简短英文标签，宁缺毋滥。
4. 只输出 JSON，不输出其他内容。

用户查询：${query}`;

  try {
    const completion = await createChatCompletion({
      temperature: 0.1,
      responseFormat: "json_object",
      messages: [
        { role: "system", content: "你是严谨的电影搜索查询理解引擎。" },
        { role: "user", content: prompt },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = safeJsonParse<Partial<StructuredQuery>>(raw, {});
    if (!parsed || typeof parsed !== "object") return null;
    return {
      ...EMPTY_STRUCTURED,
      reference_movies: parsed.reference_movies ?? [],
      genres: parsed.genres ?? [],
      moods: parsed.moods ?? [],
      styles: parsed.styles ?? [],
      themes: parsed.themes ?? [],
      countries: parsed.countries ?? [],
      languages: parsed.languages ?? [],
      year_min: parsed.year_min ?? null,
      year_max: parsed.year_max ?? null,
      exclude: parsed.exclude ?? [],
      free_text: query,
    };
  } catch (error) {
    console.error("LLM query understanding failed, falling back to local parser", error);
    return null;
  }
}

export async function understandQuery(query: string): Promise<StructuredQuery> {
  const parsed = await parseWithLlm(query);
  return parsed ?? parseQueryLocally(query);
}

export type MovieBasedOptions = {
  filters?: {
    genres?: string[];
    year_min?: number | null;
    year_max?: number | null;
    languages?: string[];
    certifications?: string[];
  };
  notes?: string;
};

export function buildStructuredQueryFromMovies(
  movies: MovieDetails[],
  options: MovieBasedOptions = {},
): StructuredQuery {
  const titles = [
    ...new Set(movies.map((movie) => movie.title || movie.original_title)),
  ];
  const selectedGenres = [
    ...new Set(movies.flatMap((movie) => movie.genres).filter(Boolean)),
  ];
  const notes = (options.notes ?? "").trim();
  const noteQuery = notes ? parseQueryLocally(notes) : null;
  const filterGenres = [
    ...(options.filters?.genres ?? []),
    ...(noteQuery?.genres ?? []),
  ];
  const genres = [...new Set([...selectedGenres, ...filterGenres])];
  const styles = [
    ...new Set(movies.flatMap((movie) => movie.ai_tags).filter(Boolean)),
    ...(noteQuery?.styles ?? []),
  ].slice(0, 8);
  const themes = [
    ...new Set(movies.flatMap((movie) => movie.keywords).filter(Boolean)),
    ...(noteQuery?.themes ?? []),
  ].slice(0, 10);
  const moods = noteQuery?.moods ?? [];
  const countryCount = new Map<string, number>();
  for (const country of movies.flatMap((movie) => movie.production_countries)) {
    countryCount.set(country, (countryCount.get(country) ?? 0) + 1);
  }
  const commonCountryThreshold = Math.ceil(movies.length / 2);
  const countries = [...countryCount.entries()]
    .filter(([, count]) => count >= commonCountryThreshold)
    .map(([country]) => country);
  const commonPoints = [
    ...genres.slice(0, 6),
    ...styles.slice(0, 6),
    ...themes.slice(0, 8),
  ].join("、");
  const notePoints = notes ? `\n用户备注：${notes}` : "";

  return {
    ...EMPTY_STRUCTURED,
    reference_movies: titles,
    reference_ids: movies.map((movie) => movie.tmdb_id),
    genres,
    filter_genres: filterGenres,
    moods,
    styles,
    themes,
    countries,
    languages: options.filters?.languages ?? [],
    year_min: options.filters?.year_min ?? null,
    year_max: options.filters?.year_max ?? null,
    certifications: options.filters?.certifications ?? [],
    notes,
    free_text: `推荐与以下电影相似的电影：${titles.join(
      "、",
    )}\n共同点：${commonPoints}${notePoints}`,
  };
}
