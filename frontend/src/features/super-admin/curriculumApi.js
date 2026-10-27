import api from "../../services/api.js";

const base = "/admin/curriculum";

export const curriculumApi = {
  stats: () => api.get(`${base}/stats`),

  listBoards: () => api.get(`${base}/boards`),
  createBoard: (body) => api.post(`${base}/boards`, body),
  updateBoard: (id, body) => api.patch(`${base}/boards/${id}`, body),
  deleteBoard: (id, cascade = false) =>
    api.delete(`${base}/boards/${id}${cascade ? "?cascade=true" : ""}`),

  listClasses: (boardId) => api.get(`${base}/boards/${boardId}/classes`),
  createClass: (body) => api.post(`${base}/classes`, body),
  updateClass: (id, body) => api.patch(`${base}/classes/${id}`, body),
  deleteClass: (id, cascade = false) =>
    api.delete(`${base}/classes/${id}${cascade ? "?cascade=true" : ""}`),

  listSubjects: (classId) => api.get(`${base}/classes/${classId}/subjects`),
  createSubject: (body) => api.post(`${base}/subjects`, body),
  updateSubject: (id, body) => api.patch(`${base}/subjects/${id}`, body),
  deleteSubject: (id, cascade = false) =>
    api.delete(`${base}/subjects/${id}${cascade ? "?cascade=true" : ""}`),

  listChapters: (subjectId) => api.get(`${base}/subjects/${subjectId}/chapters`),
  createChapter: (body) => api.post(`${base}/chapters`, body),
  updateChapter: (id, body) => api.patch(`${base}/chapters/${id}`, body),
  deleteChapter: (id, cascade = false) =>
    api.delete(`${base}/chapters/${id}${cascade ? "?cascade=true" : ""}`),

  listTopics: (chapterId) => api.get(`${base}/chapters/${chapterId}/topics`),
  createTopic: (body) => api.post(`${base}/topics`, body),
  updateTopic: (id, body) => api.patch(`${base}/topics/${id}`, body),
  deleteTopic: (id, cascade = false) =>
    api.delete(`${base}/topics/${id}${cascade ? "?cascade=true" : ""}`),

  subjectQuestionSummary: (subjectId) =>
    api.get(`${base}/subjects/${subjectId}/question-summary`),

  listQuestions: (params) => api.get(`${base}/questions`, { params }),
  createQuestion: (body) => api.post(`${base}/questions`, body),
  updateQuestion: (id, body) => api.patch(`${base}/questions/${id}`, body),
  setQuestionActive: (id, isActive) =>
    api.patch(`${base}/questions/${id}/active`, { isActive }),
  deleteQuestion: (id) => api.delete(`${base}/questions/${id}`),
};
