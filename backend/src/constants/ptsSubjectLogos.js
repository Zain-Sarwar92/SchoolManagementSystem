/**
 * PTS subject card logos (Class 9 SNC + shared electives).
 * Paths are relative to https://paktestsolution.com
 */
const PTS = "https://paktestsolution.com";

/** slug → absolute image URL */
export const PTS_SUBJECT_LOGOS = {
  biology: `${PTS}/images/subjects/638985323002816141.jpg`,
  computer: `${PTS}/images/subjects/638985324229422465.jpg`,
  chemistry: `${PTS}/images/subjects/638985325993150208.jpg`,
  physics: `${PTS}/images/subjects/638985327433826415.jpeg`,
  mathematics: `${PTS}/images/subjects/638985328533013747.jpg`,
  english: `${PTS}/images/subjects/638985329163463202.jpeg`,
  "urdu-compulsory": `${PTS}/images/subjects/638985330108498250.jpeg`,
  "islamiyat-compulsory": `${PTS}/images/subjects/638985330707198596.jpeg`,
  "general-science": `${PTS}/images/subjects/637341209184519980.jpg`,
  education: `${PTS}/images/subjects/637341209415278346.jpg`,
  punjabi: `${PTS}/images/subjects/637341209554206426.jpg`,
  "islamiyat-elective": `${PTS}/images/subjects/637341209721623963.jpg`,
  "home-economics": `${PTS}/images/subjects/637341209824182986.JPG`,
  civics: `${PTS}/images/subjects/638043497987679859.jpg`,
  economics: `${PTS}/images/subjects/638985332358969837.jpg`,
  "tarjuma-quran": `${PTS}/images/subjects/638985333217160500.jpeg`,
  ethics: `${PTS}/images/subjects/638072318047082999.jpg`,
  "physical-education": `${PTS}/images/subjects/638244238043062293.png`,
  poultry: `${PTS}/images/subjects/638349508488367676.png`,
  "pakistan-studies": `${PTS}/images/subjects/637341213848515479.jpg`,
  statistics: `${PTS}/images/subjects/637341232010600161.jpg`,
  "principles-of-accounting": `${PTS}/images/subjects/637341221784227937.jpg`,
  "principles-of-economics": `${PTS}/images/subjects/637341221903343083.jpg`,
  "principles-of-commerce": `${PTS}/images/subjects/637341222274126075.jpg`,
  "business-maths": `${PTS}/images/subjects/637341222532691649.jpg`,
  "principles-of-banking": `${PTS}/images/subjects/637341239975884096.jpg`,
  "commercial-geography": `${PTS}/images/subjects/637341240825912411.jpg`,
  "business-statistics": `${PTS}/images/subjects/637341241094700693.jpg`,
  persian: `${PTS}/images/subjects/638295033445263559.png`,
  "history-of-islam": `${PTS}/images/subjects/638373003580234972.png`,
  "library-science": `${PTS}/images/subjects/638373003828672496.png`,
  "food-nutrition": `${PTS}/images/subjects/638985333217160500.jpeg`,
};

export function logoForSubjectSlug(slug) {
  const key = String(slug || "")
    .trim()
    .toLowerCase();
  return PTS_SUBJECT_LOGOS[key] || "";
}
