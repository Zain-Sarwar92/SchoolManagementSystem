import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  GraduationCap,
  Layers,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Search,
  Settings2,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import CustomSelect from "../components/ui/CustomSelect.jsx";
import { useAcademyNav } from "../hooks/useAcademyNav.js";
import { toast } from "../components/ui/toast.jsx";
import { sectionSwatch } from "../utils/sectionColors.js";
import { academicSession, isSessionLabel, nextSessionLabel, sessionChoices } from "../utils/studentListPrint.js";
import api from "../services/api.js";
import { openProtectedUpload } from "../utils/protectedUpload.js";

const MAJOR_LABELS = {
  science: "Science",
  arts: "Arts",
};

const MAJOR_OPTIONS = [
  { value: "science", label: MAJOR_LABELS.science },
  { value: "arts", label: MAJOR_LABELS.arts },
];

const majorLabel = (major) => MAJOR_LABELS[major] || major || "—";

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const BLOOD_OPTIONS = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((v) => ({
  value: v,
  label: v || "Not set",
}));

const FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Phone" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "datetime-local", label: "Date & time" },
  { value: "url", label: "URL" },
  { value: "password", label: "Password" },
  { value: "select", label: "Dropdown" },
  { value: "radio", label: "Radio" },
  { value: "checkbox", label: "Checkbox" },
  { value: "color", label: "Color" },
  { value: "range", label: "Range slider" },
  { value: "file", label: "File upload" },
];

const GROUP_FALLBACK = {
  biology: "Biology",
  computer: "Computer",
  pre_medical: "Pre-Medical",
  pre_engineering: "Pre-Engineering",
  ics: "ICS",
  arts_general: "General Arts",
  arts_humanities: "Humanities",
  arts_commerce: "Commerce",
};

const NEXT_GROUP = {
  biology: { 10: "biology", 11: "pre_medical", 12: "pre_medical" },
  computer: { 10: "computer", 11: "pre_engineering", 12: "pre_engineering" },
  pre_medical: { 12: "pre_medical" },
  pre_engineering: { 12: "pre_engineering" },
  ics: { 12: "ics" },
};

const emptyPromote = {
  session: "",
  classId: "",
  sectionId: "",
  group: "",
  rollNumber: "",
  monthlyFee: "",
};

function classGrade(schoolClass) {
  const stored = Number(schoolClass?.gradeLevel);
  if (Number.isFinite(stored) && stored >= 1 && stored <= 12) return stored;
  const match = String(schoolClass?.name || "").match(/\b(1[0-2]|[1-9])\b/);
  return match ? Number(match[1]) : null;
}

function suggestedPromoteGroup(currentGroup, nextGrade) {
  return NEXT_GROUP[currentGroup]?.[nextGrade] || currentGroup || "";
}

const feeMethodOptions = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

function currentFeePeriodKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function feePeriodOptions(count = 12) {
  const options = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    options.push({ value, label });
  }
  return options;
}

const emptyForm = {
  name: "",
  fatherName: "",
  phone: "",
  guardianPhone: "",
  email: "",
  gender: "",
  dateOfBirth: "",
  cnicOrBForm: "",
  address: "",
  admissionDate: new Date().toISOString().slice(0, 10),
  monthlyFee: "",
  bloodGroup: "",
  rollNumber: "",
  session: "",
  classId: "",
  sectionId: "",
  major: "",
  group: "",
  isActive: true,
  customFields: {},
  collectFeeOnAdd: true,
  feePeriodKey: currentFeePeriodKey(),
  feeMethod: "cash",
  feePaidAt: new Date().toISOString().slice(0, 10),
  feeNote: "",
  collectFeeHeadIds: [],
};

const emptyFieldBuilder = {
  label: "",
  type: "text",
  required: false,
  placeholder: "",
  optionsText: "",
  min: "",
  max: "",
};

function groupLabel(value) {
  return GROUP_FALLBACK[value] || value;
}

function toDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function AcademyStudents() {
  const navItems = useAcademyNav();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const classId = searchParams.get("classId") || "";
  const sectionId = searchParams.get("sectionId") || "";
  const sessionParam = searchParams.get("session") || "";
  const session = isSessionLabel(sessionParam) ? sessionParam : academicSession();
  const sessionSelectOptions = useMemo(
    () => sessionChoices().map((value) => ({ value, label: value })),
    []
  );

  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [formGroups, setFormGroups] = useState([]);
  const [groupHint, setGroupHint] = useState("");
  const [customFieldDefs, setCustomFieldDefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [rollMeta, setRollMeta] = useState({ isFirstStudent: true, hasStudents: false });
  const [feeHeads, setFeeHeads] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [viewStudent, setViewStudent] = useState(null);
  const [showFieldManager, setShowFieldManager] = useState(false);
  const [fieldBuilder, setFieldBuilder] = useState(emptyFieldBuilder);
  const [savingField, setSavingField] = useState(false);
  const [showPrintForm, setShowPrintForm] = useState(false);
  const [printSelectedIds, setPrintSelectedIds] = useState([]);
  const [printMeta, setPrintMeta] = useState({
    title: "Student List",
    subject: "",
    exam: "",
  });
  const [promoteStudent, setPromoteStudent] = useState(null);
  const [promoteForm, setPromoteForm] = useState(emptyPromote);
  const [promoteGroups, setPromoteGroups] = useState([]);
  const [promoting, setPromoting] = useState(false);
  const [globalQuery, setGlobalQuery] = useState("");
  const [globalResults, setGlobalResults] = useState([]);
  const [globalSearching, setGlobalSearching] = useState(false);
  const [globalTotal, setGlobalTotal] = useState(0);
  const globalSearchSeq = useRef(0);
  const activeClasses = useMemo(
    () => classes.filter((item) => item.isActive !== false),
    [classes]
  );

  const selectedClass = useMemo(
    () => classes.find((item) => item._id === classId) || null,
    [classes, classId]
  );

  const selectedSection = useMemo(
    () => sections.find((item) => item._id === sectionId) || null,
    [sections, sectionId]
  );

  const classSections = useMemo(() => {
    if (!classId) return [];
    return sections.filter((section) => section.class?._id === classId);
  }, [sections, classId]);

  const formClass = useMemo(
    () => classes.find((item) => item._id === form.classId) || null,
    [classes, form.classId]
  );

  const formSectionOptions = useMemo(() => {
    if (!form.classId) return [];
    return sections
      .filter((section) => section.class?._id === form.classId && section.isActive !== false)
      .map((section) => ({
        value: section._id,
        label: section.name,
        hint: section.capacity ? `Capacity ${section.capacity}` : "Open",
      }));
  }, [sections, form.classId]);

  const classOptions = useMemo(
    () =>
      (editing ? classes : activeClasses).map((item) => ({
        value: item._id,
        label: item.name,
        hint:
          item.isActive === false
            ? "Inactive"
            : `${item.sectionCount ?? 0} sections`,
      })),
    [editing, classes, activeClasses]
  );

  const groupOptions = useMemo(
    () =>
      formGroups.map((g) => ({
        value: g.value,
        label: g.label || groupLabel(g.value),
      })),
    [formGroups]
  );

  const promoteClassOptions = useMemo(() => {
    if (!promoteStudent) return [];
    const current =
      classes.find((item) => item._id === (promoteStudent.class?._id || promoteStudent.class)) ||
      null;
    const grade = classGrade(current) || Number(promoteStudent.gradeLevel) || 0;
    const nextGrade = grade + 1;
    return activeClasses
      .filter((item) => classGrade(item) === nextGrade)
      .map((item) => ({
        value: item._id,
        label: item.name,
        hint: `Grade ${nextGrade}`,
      }));
  }, [promoteStudent, classes, activeClasses]);

  const promoteSectionOptions = useMemo(() => {
    if (!promoteForm.classId) return [];
    return sections
      .filter((item) => item.class?._id === promoteForm.classId && item.isActive !== false)
      .map((item) => ({
        value: item._id,
        label: item.name,
        hint: item.capacity ? `Capacity ${item.capacity}` : "Open",
      }));
  }, [sections, promoteForm.classId]);

  const promoteGroupOptions = useMemo(
    () =>
      promoteGroups.map((g) => ({
        value: g.value,
        label: g.label || groupLabel(g.value),
      })),
    [promoteGroups]
  );

  const filteredStudents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((student) =>
      [
        student.name,
        student.fatherName,
        student.rollNumber,
        student.phone,
        student.group,
        student.major,
        student.cnicOrBForm,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [students, query]);

  const loadBase = useCallback(async () => {
    setLoading(true);
    try {
      const [classesRes, sectionsRes, fieldsRes] = await Promise.all([
        api.get("/classes?includeInactive=true"),
        api.get("/sections"),
        api.get("/students/custom-fields?module=student"),
      ]);
      setClasses(classesRes.data.classes || []);
      setSections(sectionsRes.data.sections || []);
      setCustomFieldDefs(fieldsRes.data.fields || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load structure");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCustomFields = useCallback(async () => {
    try {
      const { data } = await api.get("/students/custom-fields?module=student");
      setCustomFieldDefs(data.fields || []);
    } catch {
      /* ignore */
    }
  }, []);

  const loadStudents = useCallback(async () => {
    if (!sectionId) {
      setStudents([]);
      return;
    }

    setStudentsLoading(true);
    try {
      const { data } = await api.get(
        `/students?sectionId=${sectionId}&session=${encodeURIComponent(session)}&includeSubjects=0`
      );
      setStudents(data.students || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load students");
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  }, [sectionId, session]);

  const fetchGroupsForClassMajor = useCallback(async (targetClassId, major) => {
    if (!targetClassId || !major) {
      setFormGroups([]);
      setGroupHint("");
      return [];
    }
    try {
      const { data } = await api.get(
        `/students/groups-for-class/${targetClassId}?major=${major}`
      );
      const next = data.groups || [];
      setFormGroups(next);
      setGroupHint(data.message || "");
      return next;
    } catch {
      setFormGroups([]);
      setGroupHint("");
      return [];
    }
  }, []);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    const needle = globalQuery.trim();
    if (needle.length < 2) {
      setGlobalResults([]);
      setGlobalTotal(0);
      setGlobalSearching(false);
      return undefined;
    }

    const seq = ++globalSearchSeq.current;
    setGlobalSearching(true);

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: needle,
          status: "active",
          includeSubjects: "0",
          limit: "25",
          session,
        });
        if (classId) params.set("classId", classId);
        if (sectionId) params.set("sectionId", sectionId);

        const { data } = await api.get(`/students?${params.toString()}`);
        if (seq !== globalSearchSeq.current) return;
        setGlobalResults(data.students || []);
        setGlobalTotal(data.totalMatched ?? data.count ?? 0);
      } catch {
        if (seq !== globalSearchSeq.current) return;
        setGlobalResults([]);
        setGlobalTotal(0);
      } finally {
        if (seq === globalSearchSeq.current) setGlobalSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [globalQuery, session, classId, sectionId]);

  const searchScopeLabel = useMemo(() => {
    if (sectionId && selectedSection) {
      return `${selectedClass?.name || "Class"} · Section ${selectedSection.name} · ${session}`;
    }
    if (classId && selectedClass) {
      return `${selectedClass.name} · all sections · ${session}`;
    }
    return `All classes · ${session}`;
  }, [sectionId, classId, selectedSection, selectedClass, session]);

  const searchPlaceholder = useMemo(() => {
    if (sectionId && selectedSection) {
      return `Search this section · ${session}`;
    }
    if (classId && selectedClass) {
      return `Search ${selectedClass.name} · ${session}`;
    }
    return `Search ${session} — name, father, roll, phone…`;
  }, [sectionId, classId, selectedSection, selectedClass, session]);

  const openStudentDetails = async (student) => {
    if (!student?._id) return;
    setViewStudent(student);
    try {
      const { data } = await api.get(`/students/${student._id}`);
      if (data.student) setViewStudent(data.student);
    } catch {
      /* keep list/search payload */
    }
  };

  const goToStudentFees = (student) => {
    if (!student?._id) return;
    setViewStudent(null);
    const params = new URLSearchParams();
    params.set("session", student.session || session);
    navigate(`/academy/fees/collect/${student._id}?${params.toString()}`);
  };

  const openStudentFromSearch = (student) => {
    const nextClassId = student.class?._id || student.class || "";
    const nextSectionId = student.section?._id || student.section || "";
    const params = new URLSearchParams();
    params.set("session", student.session || session);
    if (nextClassId) params.set("classId", nextClassId);
    if (nextSectionId) params.set("sectionId", nextSectionId);
    setSearchParams(params);
    setGlobalQuery("");
    setGlobalResults([]);
    setGlobalTotal(0);
    setQuery("");
    setShowForm(false);
    setEditing(null);
    openStudentDetails(student);
  };

  const setSession = (nextSession) => {
    const params = new URLSearchParams(searchParams);
    params.set("session", nextSession);
    setSearchParams(params);
    setQuery("");
  };

  const setStep = (nextClassId, nextSectionId) => {
    const params = new URLSearchParams();
    params.set("session", session);
    if (nextClassId) params.set("classId", nextClassId);
    if (nextSectionId) params.set("sectionId", nextSectionId);
    setSearchParams(params);
    setQuery("");
    setShowForm(false);
    setEditing(null);
    setViewStudent(null);
  };

  const suggestRoll = async (targetSectionId, sessionValue = session) => {
    if (!targetSectionId) {
      setRollMeta({ isFirstStudent: true, hasStudents: false });
      return;
    }
    try {
      const { data } = await api.get(
        `/students/next-roll/${targetSectionId}?session=${encodeURIComponent(sessionValue)}`
      );
      setRollMeta({
        isFirstStudent: Boolean(data.isFirstStudent),
        hasStudents: Boolean(data.hasStudents),
      });
      if (data.nextRollNumber) {
        setForm((prev) => ({ ...prev, rollNumber: data.nextRollNumber }));
      } else if (data.isFirstStudent) {
        setForm((prev) => ({ ...prev, rollNumber: "" }));
      }
    } catch {
      setRollMeta({ isFirstStudent: true, hasStudents: false });
    }
  };

  const openCreate = async () => {
    if (activeClasses.length === 0) {
      toast.error("Create a class first");
      navigate("/academy/classes");
      return;
    }

    const hasAnySection = sections.some((s) => s.isActive !== false);
    if (!hasAnySection) {
      toast.error("Create a section first");
      navigate("/academy/sections");
      return;
    }

    setEditing(null);
    setFormGroups([]);
    setGroupHint("");
    setForm({
      ...emptyForm,
      session,
      classId: classId || "",
      sectionId: sectionId || "",
      customFields: {},
      collectFeeHeadIds: [],
    });
    setShowForm(true);

    api
      .get("/fees/heads")
      .then((res) => {
        const heads = (res.data.heads || []).filter((h) => h.isActive !== false);
        setFeeHeads(heads);
        const monthly = heads.find(
          (h) => h.name === "Monthly Fee" || h.category === "tuition"
        );
        setForm((prev) => ({
          ...prev,
          collectFeeHeadIds: monthly?._id ? [monthly._id] : heads.map((h) => h._id),
        }));
      })
      .catch(() => setFeeHeads([]));

    if (sectionId) {
      await suggestRoll(sectionId, session);
    } else {
      setRollMeta({ isFirstStudent: true, hasStudents: false });
    }
  };

  const feeHeadAmountLabel = (head) => {
    if (head.name === "Monthly Fee" || head.category === "tuition") {
      if (form.monthlyFee === "" || form.monthlyFee == null) return "set monthly fee above";
      return `Rs ${Number(form.monthlyFee).toLocaleString("en-PK")}`;
    }
    if (head.defaultAmount == null) return "no default amount";
    return `Rs ${Number(head.defaultAmount).toLocaleString("en-PK")}`;
  };

  const toggleCollectFeeHead = (headId) => {
    setForm((prev) => {
      const current = new Set(prev.collectFeeHeadIds || []);
      if (current.has(headId)) current.delete(headId);
      else current.add(headId);
      return { ...prev, collectFeeHeadIds: [...current] };
    });
  };

  const selectedCollectTotal = useMemo(() => {
    const ids = new Set(form.collectFeeHeadIds || []);
    return feeHeads.reduce((sum, head) => {
      if (!ids.has(head._id)) return sum;
      if (head.name === "Monthly Fee" || head.category === "tuition") {
        const n = Number(form.monthlyFee);
        return sum + (Number.isFinite(n) ? n : 0);
      }
      const n = Number(head.defaultAmount);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [feeHeads, form.collectFeeHeadIds, form.monthlyFee]);

  const openEdit = async (student) => {
    const studentClassId = student.class?._id || student.class || classId;
    const studentSectionId = student.section?._id || student.section || sectionId;
    setEditing(student);
    const nextGroups = await fetchGroupsForClassMajor(
      studentClassId,
      student.major || "science"
    );
    setForm({
      name: student.name || "",
      fatherName: student.fatherName || "",
      phone: student.phone || "",
      guardianPhone: student.guardianPhone || "",
      email: student.email || "",
      gender: student.gender || "",
      dateOfBirth: toDateInput(student.dateOfBirth),
      cnicOrBForm: student.cnicOrBForm || "",
      address: student.address || "",
      admissionDate: toDateInput(student.admissionDate) || emptyForm.admissionDate,
      monthlyFee: student.monthlyFee != null ? String(student.monthlyFee) : "",
      bloodGroup: student.bloodGroup || "",
      rollNumber: student.rollNumber || "",
      session: student.session || session,
      classId: studentClassId || "",
      sectionId: studentSectionId || "",
      major: student.major || "",
      group: student.group || nextGroups[0]?.value || "",
      isActive: student.isActive !== false,
      customFields: student.customFields || {},
    });
    setRollMeta({ isFirstStudent: false, hasStudents: true });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
    setFormGroups([]);
    setGroupHint("");
  };

  const handleFormClassChange = async (value) => {
    setForm((prev) => ({
      ...prev,
      classId: value,
      sectionId: "",
      rollNumber: "",
      group: "",
    }));
    setRollMeta({ isFirstStudent: true, hasStudents: false });
    if (form.major) {
      const nextGroups = await fetchGroupsForClassMajor(value, form.major);
      setForm((prev) => ({
        ...prev,
        group: nextGroups[0]?.value || "",
      }));
    } else {
      setFormGroups([]);
      setGroupHint("");
    }
  };

  const handleFormSectionChange = async (value) => {
    setForm((prev) => ({ ...prev, sectionId: value }));
    if (!editing) {
      await suggestRoll(value, form.session || session);
    }
  };

  const handleFormMajorChange = async (value) => {
    setForm((prev) => ({
      ...prev,
      major: value,
      group: "",
    }));
    if (form.classId) {
      const nextGroups = await fetchGroupsForClassMajor(form.classId, value);
      setForm((prev) => ({
        ...prev,
        group: nextGroups[0]?.value || "",
      }));
    } else {
      setFormGroups([]);
      setGroupHint("Select a class to load groups for this major");
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const setCustomValue = (key, value) => {
    setForm((prev) => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        [key]: value,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.classId || !form.sectionId) {
      toast.error("Select class and section");
      return;
    }
    if (!form.major) {
      toast.error("Select major (Science or Arts)");
      return;
    }
    if (!form.group) {
      toast.error("Select a group");
      return;
    }
    if (!form.name.trim() || !form.fatherName.trim()) {
      toast.error("Name and father's name are required");
      return;
    }
    if (!form.phone.trim() || !form.rollNumber.trim()) {
      toast.error("Phone and roll number are required");
      return;
    }
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      toast.error("Phone must have at least 10 digits");
      return;
    }
    if (form.guardianPhone?.trim()) {
      const guardianDigits = form.guardianPhone.replace(/\D/g, "");
      if (guardianDigits.length < 10) {
        toast.error("Guardian phone must have at least 10 digits");
        return;
      }
    }
    if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error("Enter a valid email address");
      return;
    }
    if (!form.gender || !form.address.trim()) {
      toast.error("Gender and address are required");
      return;
    }
    if (form.address.trim().length < 5) {
      toast.error("Address must be at least 5 characters");
      return;
    }
    if (!form.admissionDate || form.monthlyFee === "") {
      toast.error("Admission date and monthly fee are required");
      return;
    }
    if (Number(form.monthlyFee) < 0 || Number.isNaN(Number(form.monthlyFee))) {
      toast.error("Monthly fee must be 0 or more");
      return;
    }
    if (form.dateOfBirth && form.admissionDate && form.dateOfBirth > form.admissionDate) {
      toast.error("Date of birth cannot be after admission date");
      return;
    }

    for (const field of customFieldDefs) {
      const value = form.customFields?.[field.key];
      if (field.required) {
        if (field.type === "checkbox") {
          if (!value) {
            toast.error(`${field.label} is required`);
            return;
          }
        } else if (field.type === "file") {
          const fileUrl = typeof value === "string" ? value : value?.url;
          if (!fileUrl) {
            toast.error(`${field.label} is required`);
            return;
          }
        } else if (value == null || value === "") {
          toast.error(`${field.label} is required`);
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      const payload = {
        name: form.name.trim(),
        fatherName: form.fatherName.trim(),
        phone: form.phone.trim(),
        guardianPhone: form.guardianPhone.trim(),
        email: form.email.trim(),
        gender: form.gender,
        dateOfBirth: form.dateOfBirth,
        cnicOrBForm: form.cnicOrBForm.trim(),
        address: form.address.trim(),
        admissionDate: form.admissionDate,
        monthlyFee: Number(form.monthlyFee),
        bloodGroup: form.bloodGroup,
        rollNumber: form.rollNumber.trim(),
        session: form.session || session,
        classId: form.classId,
        sectionId: form.sectionId,
        major: form.major,
        group: form.group,
        customFields: form.customFields || {},
      };

      if (editing) {
        await api.put(`/students/${editing._id}`, {
          ...payload,
          isActive: form.isActive,
        });
        toast.success("Student updated");
      } else {
        if (form.collectFeeOnAdd && !(form.collectFeeHeadIds || []).length) {
          toast.error("Select at least one fee type to collect, or turn off Collect fee now");
          setSubmitting(false);
          return;
        }
        const createPayload = {
          ...payload,
          collectFeeOnAdd: Boolean(form.collectFeeOnAdd),
          feePeriodKey: form.feePeriodKey || currentFeePeriodKey(),
          feeMethod: form.feeMethod || "cash",
          feePaidAt: form.feePaidAt || new Date().toISOString().slice(0, 10),
          feeNote: form.feeNote || "",
          collectFeeHeadIds: form.collectFeeOnAdd ? form.collectFeeHeadIds || [] : [],
        };
        const { data } = await api.post("/students", createPayload);
        const count = data.student?.enrolledCount;
        const receipt = data.feePayment?.receiptNumber;
        if (receipt) {
          toast.success(
            `Student added · fee paid (${receipt}${
              data.feePayment?.amount != null ? ` · Rs ${data.feePayment.amount}` : ""
            })`
          );
        } else {
          toast.success(
            count
              ? `Student added · ${count} subjects enrolled`
              : data.message || "Student added successfully"
          );
        }
      }

      const savedClassId = form.classId;
      const savedSectionId = form.sectionId;
      closeForm();

      if (sectionId === savedSectionId) {
        await loadStudents();
      } else {
        setStep(savedClassId, savedSectionId);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save student");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (student) => {
    try {
      await api.patch(`/students/${student._id}/toggle-active`);
      toast.success(student.isActive ? "Student deactivated" : "Student activated");
      await loadStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleDelete = async (student) => {
    if (student.isActive) {
      toast.error("Deactivate the student before deleting");
      return;
    }
    if (!window.confirm(`Delete student "${student.name}" permanently?`)) return;

    try {
      await api.delete(`/students/${student._id}`);
      toast.success("Student deleted");
      await loadStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete student");
    }
  };

  const closePromote = () => {
    setPromoteStudent(null);
    setPromoteForm(emptyPromote);
    setPromoteGroups([]);
  };

  const canPromoteStudent = (student) => {
    if (!student || student.isActive === false) return false;
    const currentClass =
      classes.find((item) => item._id === (student.class?._id || student.class)) || null;
    const grade = classGrade(currentClass) || Number(student.gradeLevel) || 0;
    return grade > 0 && grade < 12;
  };

  const startPromote = async (student) => {
    setViewStudent(null);
    setGlobalQuery("");
    setGlobalResults([]);
    setGlobalTotal(0);
    await openPromote(student);
  };

  const openPromote = async (student) => {
    const currentClass =
      classes.find((item) => item._id === (student.class?._id || student.class)) || null;
    const grade = classGrade(currentClass) || Number(student.gradeLevel) || null;
    if (!grade) {
      toast.error("This class needs a grade before promotion");
      return;
    }
    if (grade >= 12) {
      toast.error("Class 12 students cannot be promoted further");
      return;
    }
    if (student.isActive === false) {
      toast.error("Activate the student before promoting");
      return;
    }

    const nextSession = nextSessionLabel(student.session || session);
    if (!nextSession) {
      toast.error("Could not determine the next session");
      return;
    }

    const nextGrade = grade + 1;
    const nextClass =
      activeClasses.find((item) => classGrade(item) === nextGrade) || null;
    if (!nextClass) {
      toast.error(`Create Class ${nextGrade} first`);
      return;
    }

    const currentSectionName =
      student.section?.name ||
      sections.find((item) => item._id === (student.section?._id || student.section))?.name ||
      "";
    const nextSections = sections.filter(
      (item) => item.class?._id === nextClass._id && item.isActive !== false
    );
    const matchedSection =
      nextSections.find(
        (item) => item.name.toLowerCase() === String(currentSectionName).toLowerCase()
      ) ||
      nextSections[0] ||
      null;

    let nextGroups = [];
    try {
      const { data } = await api.get(
        `/students/groups-for-class/${nextClass._id}?major=${student.major || "science"}`
      );
      nextGroups = data.groups || [];
    } catch {
      nextGroups = [];
    }
    const groupValues = nextGroups.map((item) => item.value);
    const preferred = suggestedPromoteGroup(student.group, nextGrade);
    const nextGroup = groupValues.includes(preferred)
      ? preferred
      : groupValues[0] || student.group || "";

    setPromoteGroups(nextGroups);
    setPromoteStudent(student);
    setPromoteForm({
      session: nextSession,
      classId: nextClass._id,
      sectionId: matchedSection?._id || "",
      group: nextGroup,
      rollNumber: "",
      monthlyFee: student.monthlyFee != null ? String(student.monthlyFee) : "",
    });

    if (matchedSection?._id) {
      try {
        const { data } = await api.get(
          `/students/next-roll/${matchedSection._id}?session=${encodeURIComponent(nextSession)}`
        );
        if (data.nextRollNumber) {
          setPromoteForm((prev) => ({ ...prev, rollNumber: data.nextRollNumber }));
        }
      } catch {
        /* manual roll */
      }
    }
  };

  const handlePromoteClassChange = async (value) => {
    const nextClass = classes.find((item) => item._id === value) || null;
    const nextGrade = classGrade(nextClass);
    const nextSections = sections.filter(
      (item) => item.class?._id === value && item.isActive !== false
    );
    const matched =
      nextSections.find(
        (item) =>
          item.name.toLowerCase() ===
          String(promoteStudent?.section?.name || "").toLowerCase()
      ) ||
      nextSections[0] ||
      null;

    let nextGroups = [];
    try {
      const { data } = await api.get(
        `/students/groups-for-class/${value}?major=${promoteStudent?.major || "science"}`
      );
      nextGroups = data.groups || [];
    } catch {
      nextGroups = [];
    }
    const preferred = suggestedPromoteGroup(promoteStudent?.group, nextGrade);
    const groupValues = nextGroups.map((item) => item.value);
    const sessionValue = promoteForm.session;

    setPromoteGroups(nextGroups);
    setPromoteForm((prev) => ({
      ...prev,
      classId: value,
      sectionId: matched?._id || "",
      group: groupValues.includes(preferred) ? preferred : groupValues[0] || "",
      rollNumber: "",
    }));

    if (matched?._id) {
      try {
        const { data } = await api.get(
          `/students/next-roll/${matched._id}?session=${encodeURIComponent(sessionValue)}`
        );
        if (data.nextRollNumber) {
          setPromoteForm((prev) => ({ ...prev, rollNumber: data.nextRollNumber }));
        }
      } catch {
        /* ignore */
      }
    }
  };

  const handlePromoteSectionChange = async (value) => {
    const sessionValue = promoteForm.session;
    setPromoteForm((prev) => ({ ...prev, sectionId: value, rollNumber: "" }));
    try {
      const { data } = await api.get(
        `/students/next-roll/${value}?session=${encodeURIComponent(sessionValue)}`
      );
      if (data.nextRollNumber) {
        setPromoteForm((prev) => ({ ...prev, rollNumber: data.nextRollNumber }));
      }
    } catch {
      /* ignore */
    }
  };

  const handlePromote = async (e) => {
    e.preventDefault();
    if (!promoteStudent) return;
    if (!promoteForm.classId || !promoteForm.sectionId) {
      toast.error("Select class and section");
      return;
    }
    if (!promoteForm.group || !promoteForm.rollNumber.trim()) {
      toast.error("Group and roll number are required");
      return;
    }

    setPromoting(true);
    try {
      const { data } = await api.post(`/students/${promoteStudent._id}/promote`, {
        session: promoteForm.session,
        classId: promoteForm.classId,
        sectionId: promoteForm.sectionId,
        group: promoteForm.group,
        rollNumber: promoteForm.rollNumber.trim(),
        monthlyFee:
          promoteForm.monthlyFee === "" ? undefined : Number(promoteForm.monthlyFee),
      });
      toast.success(data.message || "Student promoted");
      const nextClassId = promoteForm.classId;
      const nextSectionId = promoteForm.sectionId;
      const nextSession = promoteForm.session;
      closePromote();
      const params = new URLSearchParams();
      params.set("session", nextSession);
      params.set("classId", nextClassId);
      params.set("sectionId", nextSectionId);
      setSearchParams(params);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to promote student");
    } finally {
      setPromoting(false);
    }
  };

  const handleCreateCustomField = async (e) => {
    e.preventDefault();
    if (!fieldBuilder.label.trim()) {
      toast.error("Field label is required");
      return;
    }

    setSavingField(true);
    try {
      await api.post("/students/custom-fields", {
        label: fieldBuilder.label.trim(),
        type: fieldBuilder.type,
        required: fieldBuilder.required,
        placeholder: fieldBuilder.placeholder.trim(),
        optionsText: fieldBuilder.optionsText,
        min: fieldBuilder.min,
        max: fieldBuilder.max,
        module: "student",
      });
      toast.success("Custom field added to all student forms");
      setFieldBuilder(emptyFieldBuilder);
      await loadCustomFields();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add field");
    } finally {
      setSavingField(false);
    }
  };

  const handleDeleteCustomField = async (field) => {
    if (!window.confirm(`Remove custom field "${field.label}"?`)) return;
    try {
      await api.delete(`/students/custom-fields/${field._id}`);
      toast.success("Custom field removed");
      await loadCustomFields();
      setForm((prev) => {
        const next = { ...prev.customFields };
        delete next[field.key];
        return { ...prev, customFields: next };
      });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove field");
    }
  };

  const renderCustomInput = (field) => {
    const value = form.customFields?.[field.key];
    const common =
      "w-full rounded-xl border border-rose/60 bg-bg-soft px-4 py-2.5 text-navy outline-none transition focus:border-lavender focus:ring-2 focus:ring-lavender/40";

    if (field.type === "textarea") {
      return (
        <textarea
          rows={3}
          required={field.required}
          placeholder={field.placeholder || ""}
          value={value || ""}
          onChange={(e) => setCustomValue(field.key, e.target.value)}
          className={`${common} resize-y`}
        />
      );
    }

    if (field.type === "select") {
      return (
        <CustomSelect
          searchable={(field.options || []).length > 5}
          required={field.required}
          value={value || ""}
          options={(field.options || []).map((o) => ({ value: o, label: o }))}
          onChange={(v) => setCustomValue(field.key, v)}
          placeholder={field.placeholder || "Select"}
        />
      );
    }

    if (field.type === "radio") {
      return (
        <div className="flex flex-wrap gap-3">
          {(field.options || []).map((option) => (
            <label key={option} className="inline-flex items-center gap-2 text-sm text-navy">
              <input
                type="radio"
                name={`cf_${field.key}`}
                checked={value === option}
                onChange={() => setCustomValue(field.key, option)}
                required={field.required}
              />
              {option}
            </label>
          ))}
        </div>
      );
    }

    if (field.type === "checkbox") {
      return (
        <label className="inline-flex items-center gap-2 text-sm text-navy">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => setCustomValue(field.key, e.target.checked)}
          />
          {field.placeholder || field.label}
        </label>
      );
    }

    if (field.type === "range") {
      return (
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={field.min ?? 0}
            max={field.max ?? 100}
            value={value ?? field.min ?? 0}
            onChange={(e) => setCustomValue(field.key, e.target.value)}
            className="w-full"
          />
          <span className="text-sm font-medium text-navy">{value ?? field.min ?? 0}</span>
        </div>
      );
    }

    if (field.type === "file") {
      const fileUrl = typeof value === "string" ? value : value?.url || "";
      const fileName =
        typeof value === "object" && value?.originalName
          ? value.originalName
          : fileUrl
            ? fileUrl.split("/").pop()
            : "";
      return (
        <div className="space-y-2">
          <input
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            required={field.required && !fileUrl}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const body = new FormData();
              body.append("file", file);
              try {
                const { data } = await api.post("/students/upload-file", body);
                setCustomValue(field.key, {
                  url: data.url,
                  originalName: data.originalName || file.name,
                });
                toast.success("File uploaded");
              } catch (err) {
                toast.error(err.response?.data?.message || "File upload failed");
              } finally {
                e.target.value = "";
              }
            }}
            className="block w-full text-sm text-navy file:mr-3 file:rounded-lg file:border-0 file:bg-navy file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blush"
          />
          {fileUrl ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await openProtectedUpload(fileUrl);
                  } catch {
                    toast.error("Could not open file");
                  }
                }}
                className="cursor-pointer font-medium text-navy underline"
              >
                {fileName || "View file"}
              </button>
              <button
                type="button"
                onClick={() => setCustomValue(field.key, "")}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-[#a33b4a] hover:bg-rose/40"
              >
                Clear
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <input
        type={field.type}
        required={field.required}
        placeholder={field.placeholder || ""}
        min={field.min ?? undefined}
        max={field.max ?? undefined}
        value={value || ""}
        onChange={(e) => setCustomValue(field.key, e.target.value)}
        className={common}
      />
    );
  };

  const printSectionsByClass = useMemo(() => {
    return activeClasses
      .map((cls) => {
        const classSectionsList = sections
          .filter((section) => section.class?._id === cls._id)
          .slice()
          .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
        return {
          classId: cls._id,
          className: cls.name,
          sections: classSectionsList,
        };
      })
      .filter((group) => group.sections.length > 0);
  }, [activeClasses, sections]);

  const allPrintableSectionIds = useMemo(
    () => printSectionsByClass.flatMap((group) => group.sections.map((s) => s._id)),
    [printSectionsByClass]
  );

  const openPrintForm = () => {
    if (activeClasses.length === 0) {
      toast.error("Create a class first");
      navigate("/academy/classes");
      return;
    }

    if (allPrintableSectionIds.length === 0) {
      toast.error("Create sections first");
      navigate("/academy/sections");
      return;
    }

    // Pre-select current section if viewing one; otherwise leave empty so user picks
    setPrintSelectedIds(sectionId ? [sectionId] : []);
    setPrintMeta({
      title: "Student List",
      subject: "",
      exam: "",
    });
    setShowPrintForm(true);
  };

  const togglePrintSection = (id) => {
    setPrintSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const togglePrintClass = (classSectionIds) => {
    setPrintSelectedIds((prev) => {
      const allSelected = classSectionIds.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !classSectionIds.includes(id));
      }
      const next = new Set(prev);
      classSectionIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const selectAllPrintSections = () => {
    setPrintSelectedIds(allPrintableSectionIds);
  };

  const clearPrintSelection = () => {
    setPrintSelectedIds([]);
  };

  const handlePrintSubmit = (e) => {
    e.preventDefault();

    if (printSelectedIds.length === 0) {
      toast.error("Select at least one section");
      return;
    }

    // Keep order: class order, then section name order from printSectionsByClass
    const orderedIds = allPrintableSectionIds.filter((id) =>
      printSelectedIds.includes(id)
    );

    const backParams = new URLSearchParams();
    backParams.set("session", session);
    if (classId) backParams.set("classId", classId);
    if (sectionId) backParams.set("sectionId", sectionId);
    const back = encodeURIComponent(`/academy/students?${backParams.toString()}`);

    const params = new URLSearchParams();
    params.set("back", back);
    params.set("session", session);
    if (printMeta.title.trim()) params.set("title", printMeta.title.trim());
    if (printMeta.subject.trim()) params.set("subject", printMeta.subject.trim());
    if (printMeta.exam.trim()) params.set("exam", printMeta.exam.trim());

    setShowPrintForm(false);

    // Single section → dedicated print page; multiple → batch with page breaks
    if (orderedIds.length === 1) {
      navigate(`/academy/students/print/${orderedIds[0]}?${params.toString()}`);
      return;
    }

    params.set("sections", orderedIds.join(","));
    navigate(`/academy/students/print-batch?${params.toString()}`);
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={openPrintForm}
        className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-rose/45 bg-white text-navy transition hover:bg-blush"
        aria-label="Print list"
        title="Print list"
      >
        <Printer className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => {
          setFieldBuilder(emptyFieldBuilder);
          setShowFieldManager(true);
        }}
        className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-rose/45 bg-white text-navy transition hover:bg-blush"
        aria-label="Custom fields"
        title="Custom fields"
      >
        <Settings2 className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={openCreate}
        className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-blush transition hover:bg-slate sm:flex-none"
      >
        <Plus className="size-4" aria-hidden="true" />
        Add Student
      </button>
    </div>
  );

  const crumb = (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-slate">
      <button
        type="button"
        onClick={() => setStep("", "")}
        className={[
          "rounded-lg px-2 py-1 font-medium transition",
          !classId ? "bg-navy text-blush" : "hover:bg-blush hover:text-navy",
        ].join(" ")}
      >
        Classes
      </button>
      {selectedClass ? (
        <>
          <ChevronRight className="size-3.5 shrink-0 opacity-50" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setStep(classId, "")}
            className={[
              "max-w-40 truncate rounded-lg px-2 py-1 font-medium transition sm:max-w-none",
              classId && !sectionId ? "bg-navy text-blush" : "hover:bg-blush hover:text-navy",
            ].join(" ")}
          >
            {selectedClass.name}
          </button>
        </>
      ) : null}
      {selectedSection ? (
        <>
          <ChevronRight className="size-3.5 shrink-0 opacity-50" aria-hidden="true" />
          <span className="max-w-40 truncate rounded-lg bg-navy px-2 py-1 font-medium text-blush sm:max-w-none">
            {selectedSection.name}
          </span>
        </>
      ) : null}
    </nav>
  );

  const inputClass =
    "w-full rounded-xl border border-rose/60 bg-bg-soft px-4 py-2.5 text-navy outline-none transition focus:border-lavender focus:ring-2 focus:ring-lavender/40";

  return (
    <DashboardLayout title="Students" navItems={navItems}>
      <section className="sms-surface rounded-2xl p-4 sm:rounded-3xl sm:p-6">
        {crumb}

        <div className="mb-5">
          <label className="relative block">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate"
              aria-hidden="true"
            />
            <input
              type="search"
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="min-h-11 w-full rounded-xl border border-rose/50 bg-white py-2.5 pr-3 pl-10 text-sm text-navy outline-none transition focus:border-navy"
              aria-label={`Search students in ${searchScopeLabel}`}
            />
          </label>

          {globalQuery.trim().length >= 2 && (
            <div className="mt-2 overflow-hidden rounded-xl border border-rose/40 bg-white shadow-[0_8px_24px_rgb(31_34_50_/0.08)]">
              {globalSearching ? (
                <p className="px-4 py-3 text-sm text-slate">Searching…</p>
              ) : globalResults.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate">No students matched</p>
              ) : (
                <>
                  <p className="border-b border-rose/20 px-4 py-2 text-xs font-semibold text-slate">
                    {searchScopeLabel}
                    {" · "}
                    {globalTotal} match{globalTotal === 1 ? "" : "es"}
                    {globalTotal > globalResults.length
                      ? ` · showing ${globalResults.length}`
                      : ""}
                  </p>
                  <ul className="max-h-72 divide-y divide-rose/20 overflow-y-auto">
                    {globalResults.map((student) => {
                      const className =
                        student.class?.name ||
                        classes.find((c) => c._id === (student.class?._id || student.class))
                          ?.name ||
                        "Class";
                      const sectionName =
                        student.section?.name ||
                        sections.find(
                          (s) => s._id === (student.section?._id || student.section)
                        )?.name ||
                        "Section";
                      const showPromote = canPromoteStudent(student);
                      return (
                        <li key={student._id} className="flex items-stretch gap-1 px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => openStudentFromSearch(student)}
                            className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-blush/50"
                          >
                            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-navy/90 text-blush">
                              <UserRound className="size-4" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-navy">
                                {student.name}
                                {student.rollNumber ? (
                                  <span className="ml-2 font-medium text-slate">
                                    · Roll {student.rollNumber}
                                  </span>
                                ) : null}
                              </p>
                              <p className="mt-0.5 truncate text-sm text-slate">
                                {student.session ? `${student.session} · ` : ""}
                                {className} · Section {sectionName}
                                {student.fatherName ? ` · S/O ${student.fatherName}` : ""}
                              </p>
                            </div>
                          </button>
                          {showPromote ? (
                            <button
                              type="button"
                              onClick={() => startPromote(student)}
                              className="my-1 shrink-0 self-center rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-blush transition hover:bg-slate"
                            >
                              Promote
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mb-5 w-full sm:max-w-xs">
          <CustomSelect
            id="academicSession"
            label="Session"
            searchable={false}
            value={session}
            options={sessionSelectOptions}
            onChange={setSession}
          />
        </div>

        {!classId && (
          <>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-2xl font-semibold text-navy">Students</h2>
                <p className="mt-0.5 text-sm text-slate">
                  Search any student above, add one here, or open a class to browse by section.
                </p>
              </div>
              {headerActions}
            </div>

            {loading ? (
              <p className="text-sm text-slate">Loading classes...</p>
            ) : classes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-rose/50 bg-white/60 px-4 py-10 text-center">
                <GraduationCap className="mx-auto mb-2 size-8 text-lavender" aria-hidden="true" />
                <p className="font-medium text-navy">No classes yet</p>
                <Link
                  to="/academy/classes"
                  className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-navy px-4 text-sm font-semibold text-blush"
                >
                  Create a class
                </Link>
              </div>
            ) : (
              <div className="sms-list">
                {activeClasses.map((schoolClass) => (
                  <button
                    key={schoolClass._id}
                    type="button"
                    onClick={() => setStep(schoolClass._id, "")}
                    className="sms-row sms-row--link w-full text-left"
                  >
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-navy/90 text-blush">
                      <GraduationCap className="size-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg font-semibold text-navy">
                        {schoolClass.name}
                      </h3>
                      <p className="mt-0.5 text-sm text-slate">
                        {schoolClass.sectionCount} section
                        {schoolClass.sectionCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-slate" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {classId && !sectionId && (
          <>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <button
                  type="button"
                  onClick={() => setStep("", "")}
                  className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate transition hover:text-navy"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  All classes
                </button>
                <h2 className="font-display text-2xl font-semibold text-navy">
                  {selectedClass?.name || "Class"}
                </h2>
                <p className="mt-0.5 text-sm text-slate">Pick a section to view students</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setFieldBuilder(emptyFieldBuilder);
                    setShowFieldManager(true);
                  }}
                  className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-rose/50 px-4 py-2.5 text-sm font-semibold text-navy transition hover:bg-blush sm:w-auto"
                >
                  <Settings2 className="size-4" aria-hidden="true" />
                  Custom Fields
                </button>
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-blush transition hover:bg-slate sm:w-auto"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add Student
                </button>
                <Link
                  to={`/academy/sections?classId=${classId}`}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose/50 px-4 text-sm font-semibold text-navy transition hover:bg-blush sm:w-auto"
                >
                  <Layers className="size-4" aria-hidden="true" />
                  Manage sections
                </Link>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-slate">Loading sections...</p>
            ) : classSections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-rose/50 bg-white/60 px-4 py-10 text-center">
                <Layers className="mx-auto mb-2 size-8 text-lavender" aria-hidden="true" />
                <p className="font-medium text-navy">No sections in this class</p>
              </div>
            ) : (
              <div className="sms-list">
                {classSections.map((section) => {
                  const swatch = sectionSwatch(section.name);
                  return (
                    <button
                      key={section._id}
                      type="button"
                      onClick={() => setStep(classId, section._id)}
                      className="sms-row sms-row--link w-full text-left"
                    >
                      <span
                        className="sms-swatch"
                        style={{ backgroundColor: swatch }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-lg font-semibold text-navy">
                          {section.name}
                        </h3>
                        <p className="text-sm text-slate">
                          {section.capacity ? `Capacity ${section.capacity}` : "Open section"}
                        </p>
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-slate" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {classId && sectionId && (
          <>
            <div className="mb-5">
              <button
                type="button"
                onClick={() => setStep(classId, "")}
                className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate transition hover:text-navy"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Sections
              </button>

              <div className="rounded-2xl border border-rose/35 bg-white/80 px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="mt-1.5 size-3 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(31_34_50_/0.12)]"
                      style={{ backgroundColor: sectionSwatch(selectedSection?.name || "") }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold tracking-[0.14em] text-slate uppercase">
                        Section
                      </p>
                      <h2 className="font-display text-3xl font-semibold tracking-tight text-navy">
                        {selectedSection?.name || "Section"}
                      </h2>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-lg bg-navy/90 px-2 py-1 text-[11px] font-semibold text-blush">
                          {selectedClass?.name || "Class"}
                        </span>
                        <span className="rounded-lg bg-blush px-2 py-1 text-[11px] font-semibold text-navy">
                          {session}
                        </span>
                        <span className="rounded-lg border border-rose/40 bg-white px-2 py-1 text-[11px] font-semibold text-navy">
                          {studentsLoading
                            ? "Loading…"
                            : `${students.length} student${students.length === 1 ? "" : "s"}`}
                        </span>
                      </div>
                    </div>
                  </div>
                  {headerActions}
                </div>
              </div>
            </div>

            {studentsLoading ? (
              <p className="text-sm text-slate">Loading students...</p>
            ) : filteredStudents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-rose/50 bg-white/60 px-4 py-10 text-center">
                <UserRound className="mx-auto mb-2 size-8 text-lavender" aria-hidden="true" />
                <p className="font-medium text-navy">
                  {query ? "No matches" : `No students in this section for ${session}`}
                </p>
                {!query ? (
                  <button
                    type="button"
                    onClick={openCreate}
                    className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-blush"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Add first student
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="sms-list">
                {filteredStudents.map((student) => (
                  <div
                    key={student._id}
                    className="sms-row flex-col items-stretch gap-3 sm:flex-row sm:items-center"
                  >
                    <button
                      type="button"
                      onClick={() => openStudentDetails(student)}
                      className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-xl text-left transition"
                    >
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-navy text-sm font-bold text-blush">
                        {String(student.rollNumber || "?")
                          .split("-")
                          .pop()
                          ?.slice(-2) || "#"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <h3 className="font-display text-base font-semibold text-navy sm:text-lg">
                            {student.name}
                          </h3>
                          <span className="font-mono text-xs font-semibold text-slate">
                            {student.rollNumber}
                          </span>
                          {!student.isActive ? (
                            <span className="rounded-md bg-rose/50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-navy">
                              Inactive
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-sm text-slate">
                          S/O {student.fatherName}
                          <span className="mx-1.5 opacity-40">·</span>
                          {majorLabel(student.major)} / {groupLabel(student.group)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate">
                          <span className="break-all">{student.phone}</span>
                          {student.monthlyFee != null ? (
                            <>
                              <span className="mx-1.5 opacity-40">·</span>
                              Fee Rs {student.monthlyFee}
                            </>
                          ) : null}
                        </p>
                      </div>
                    </button>
                    <div className="sms-actions ml-0 sm:ml-auto">
                      <button
                        type="button"
                        onClick={() => goToStudentFees(student)}
                        className="sms-action"
                      >
                        <Receipt className="size-3.5" aria-hidden="true" />
                        Fees
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(student)}
                        className="sms-action"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Edit
                      </button>
                      {student.isActive !== false &&
                      (classGrade(selectedClass) || Number(student.gradeLevel) || 0) < 12 ? (
                        <button
                          type="button"
                          onClick={() => startPromote(student)}
                          className="sms-action"
                        >
                          Promote
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleToggle(student)}
                        className="sms-action"
                      >
                        {student.isActive ? "Deactivate" : "Activate"}
                      </button>
                      {!student.isActive ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(student)}
                          className="sms-action sms-action--danger"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-navy/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-form-title"
            className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl border border-rose/40 bg-white p-4 shadow-[0_20px_50px_rgb(31_34_50_/0.25)] sm:rounded-3xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 id="student-form-title" className="font-display text-2xl font-semibold text-navy">
                  {editing ? "Edit Student" : "Add Student"}
                </h2>
                <p className="text-sm text-slate">
                  {formClass?.name || "Select class & section"}
                  {form.major ? ` · ${majorLabel(form.major)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="cursor-pointer rounded-xl p-2 text-slate transition hover:bg-blush hover:text-navy"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <section className="space-y-4">
                <h3 className="font-display text-sm font-semibold tracking-wide text-slate uppercase">
                  Placement
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <CustomSelect
                    id="studentSession"
                    label="Session"
                    required
                    searchable={false}
                    value={form.session || session}
                    options={sessionSelectOptions}
                    onChange={async (value) => {
                      setForm((prev) => ({ ...prev, session: value }));
                      if (!editing && form.sectionId) {
                        await suggestRoll(form.sectionId, value);
                      }
                    }}
                  />
                  <CustomSelect
                    id="studentClassId"
                    label="Class"
                    required
                    searchable={classOptions.length > 5}
                    value={form.classId}
                    options={classOptions}
                    onChange={handleFormClassChange}
                    placeholder="Select class"
                  />
                  <CustomSelect
                    id="studentSectionId"
                    label="Section"
                    required
                    searchable={formSectionOptions.length > 5}
                    value={form.sectionId}
                    options={formSectionOptions}
                    onChange={handleFormSectionChange}
                    placeholder={form.classId ? "Select section" : "Select class first"}
                    disabled={!form.classId}
                    emptyText="No sections in this class"
                  />
                  <CustomSelect
                    id="major"
                    label="Major"
                    required
                    searchable={false}
                    value={form.major}
                    options={MAJOR_OPTIONS}
                    onChange={handleFormMajorChange}
                    placeholder="Science or Arts"
                  />
                  <CustomSelect
                    id="group"
                    label="Group"
                    required
                    searchable={false}
                    value={form.group}
                    options={groupOptions}
                    onChange={(value) => setForm((prev) => ({ ...prev, group: value }))}
                    placeholder={
                      !form.classId
                        ? "Select class first"
                        : !form.major
                          ? "Select major first"
                          : groupOptions.length
                            ? "Select group"
                            : "No groups for this class"
                    }
                    disabled={!form.classId || !form.major || groupOptions.length === 0}
                    emptyText="No groups for this class / major"
                  />
                </div>
                {groupHint ? (
                  <p className="rounded-xl bg-rose/40 px-3 py-2 text-xs text-navy">{groupHint}</p>
                ) : form.major === "science" && form.classId ? (
                  <p className="rounded-xl bg-blush/70 px-3 py-2 text-xs text-slate">
                    Class 9–10 → Biology / Computer · Class 11–12 → Pre-Medical / Pre-Engineering /
                    ICS (from class name, e.g. &quot;Class 9&quot;).
                  </p>
                ) : null}
              </section>

              <section className="space-y-4">
                <h3 className="font-display text-sm font-semibold tracking-wide text-slate uppercase">
                  Personal
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-navy">
                      Student Name <span className="text-[#a33b4a]">*</span>
                    </label>
                    <input
                      id="name"
                      name="name"
                      required
                      value={form.name}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="fatherName" className="mb-1.5 block text-sm font-medium text-navy">
                      Father&apos;s Name <span className="text-[#a33b4a]">*</span>
                    </label>
                    <input
                      id="fatherName"
                      name="fatherName"
                      required
                      value={form.fatherName}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                  <CustomSelect
                    id="gender"
                    label="Gender"
                    required
                    searchable={false}
                    value={form.gender}
                    options={GENDER_OPTIONS}
                    onChange={(value) => setForm((prev) => ({ ...prev, gender: value }))}
                    placeholder="Select gender"
                  />
                  <div>
                    <label htmlFor="dateOfBirth" className="mb-1.5 block text-sm font-medium text-navy">
                      Date of Birth <span className="font-normal text-slate">(optional)</span>
                    </label>
                    <input
                      id="dateOfBirth"
                      name="dateOfBirth"
                      type="date"
                      value={form.dateOfBirth}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="cnicOrBForm" className="mb-1.5 block text-sm font-medium text-navy">
                      CNIC / B-Form <span className="font-normal text-slate">(optional)</span>
                    </label>
                    <input
                      id="cnicOrBForm"
                      name="cnicOrBForm"
                      value={form.cnicOrBForm}
                      onChange={handleChange}
                      placeholder="xxxxx-xxxxxxx-x"
                      className={inputClass}
                    />
                  </div>
                  <CustomSelect
                    id="bloodGroup"
                    label="Blood Group"
                    searchable={false}
                    value={form.bloodGroup}
                    options={BLOOD_OPTIONS}
                    onChange={(value) => setForm((prev) => ({ ...prev, bloodGroup: value }))}
                    placeholder="Optional"
                  />
                  <div className="sm:col-span-2">
                    <label htmlFor="address" className="mb-1.5 block text-sm font-medium text-navy">
                      Address <span className="text-[#a33b4a]">*</span>
                    </label>
                    <textarea
                      id="address"
                      name="address"
                      required
                      rows={2}
                      value={form.address}
                      onChange={handleChange}
                      className={`${inputClass} resize-y`}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="font-display text-sm font-semibold tracking-wide text-slate uppercase">
                  Contact &amp; admission
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-navy">
                      Phone <span className="text-[#a33b4a]">*</span>
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      required
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="03XXXXXXXXX"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="guardianPhone"
                      className="mb-1.5 block text-sm font-medium text-navy"
                    >
                      Guardian Phone
                    </label>
                    <input
                      id="guardianPhone"
                      name="guardianPhone"
                      type="tel"
                      value={form.guardianPhone}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-navy">
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="admissionDate"
                      className="mb-1.5 block text-sm font-medium text-navy"
                    >
                      Admission Date <span className="text-[#a33b4a]">*</span>
                    </label>
                    <input
                      id="admissionDate"
                      name="admissionDate"
                      type="date"
                      required
                      value={form.admissionDate}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="monthlyFee" className="mb-1.5 block text-sm font-medium text-navy">
                      Monthly Fee (Rs) <span className="text-[#a33b4a]">*</span>
                    </label>
                    <input
                      id="monthlyFee"
                      name="monthlyFee"
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={form.monthlyFee}
                      onChange={handleChange}
                      placeholder="e.g. 5000"
                      className={inputClass}
                    />
                  </div>
                  {!editing ? (
                    <div className="sm:col-span-2 rounded-2xl border border-rose/35 bg-blush/30 px-4 py-4">
                      <div className="mb-3">
                        <p className="font-semibold text-navy">
                          Academy fee types ({feeHeads.length || "…"})
                        </p>
                        <p className="mt-0.5 text-sm text-slate">
                          Ye is academy ke fee types hain. Jo collect karna ho unhe tick karo.
                        </p>
                      </div>

                      {feeHeads.length === 0 ? (
                        <p className="mb-4 text-sm text-slate">Loading fee types…</p>
                      ) : (
                        <ul className="mb-4 space-y-2">
                          {feeHeads.map((head) => {
                            const checked = (form.collectFeeHeadIds || []).includes(head._id);
                            return (
                              <li key={head._id}>
                                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-rose/30 bg-white/80 px-3 py-2.5">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={!form.collectFeeOnAdd}
                                    onChange={() => toggleCollectFeeHead(head._id)}
                                    className="mt-0.5 size-4 rounded border-rose/50 text-navy disabled:opacity-40"
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center gap-2">
                                      <span className="font-semibold text-navy">{head.name}</span>
                                      <span className="rounded-md bg-blush px-1.5 py-0.5 text-[10px] font-bold uppercase text-navy">
                                        {head.frequency === "one_time" ? "One-time" : "Monthly"}
                                      </span>
                                      <span className="rounded-md bg-lavender/25 px-1.5 py-0.5 text-[10px] font-bold uppercase text-navy">
                                        {head.category}
                                      </span>
                                    </span>
                                    <span className="mt-0.5 block text-sm text-slate">
                                      {feeHeadAmountLabel(head)}
                                    </span>
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={Boolean(form.collectFeeOnAdd)}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              collectFeeOnAdd: e.target.checked,
                            }))
                          }
                          className="mt-1 size-4 rounded border-rose/50 text-navy"
                        />
                        <span>
                          <span className="block font-semibold text-navy">
                            Collect selected fees now
                          </span>
                          <span className="mt-0.5 block text-sm text-slate">
                            Tick ki hui fee types paid mark ho jayengi. Un ke liye Generate
                            zaroori nahi.
                          </span>
                        </span>
                      </label>

                      {form.collectFeeOnAdd ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <CustomSelect
                            label="Fee period"
                            value={form.feePeriodKey || currentFeePeriodKey()}
                            options={feePeriodOptions()}
                            onChange={(value) =>
                              setForm((prev) => ({ ...prev, feePeriodKey: value }))
                            }
                            searchable={false}
                          />
                          <CustomSelect
                            label="Payment method"
                            value={form.feeMethod || "cash"}
                            options={feeMethodOptions}
                            onChange={(value) =>
                              setForm((prev) => ({ ...prev, feeMethod: value }))
                            }
                            searchable={false}
                          />
                          <div>
                            <label
                              htmlFor="feePaidAt"
                              className="mb-1.5 block text-sm font-medium text-navy"
                            >
                              Paid on
                            </label>
                            <input
                              id="feePaidAt"
                              type="date"
                              value={form.feePaidAt || ""}
                              onChange={(e) =>
                                setForm((prev) => ({ ...prev, feePaidAt: e.target.value }))
                              }
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="feeNote"
                              className="mb-1.5 block text-sm font-medium text-navy"
                            >
                              Note
                            </label>
                            <input
                              id="feeNote"
                              type="text"
                              value={form.feeNote || ""}
                              onChange={(e) =>
                                setForm((prev) => ({ ...prev, feeNote: e.target.value }))
                              }
                              placeholder="Optional"
                              className={inputClass}
                            />
                          </div>
                          {(form.collectFeeHeadIds || []).length > 0 ? (
                            <p className="sm:col-span-2 text-sm font-medium text-navy">
                              Will collect {(form.collectFeeHeadIds || []).length} fee type
                              {(form.collectFeeHeadIds || []).length === 1 ? "" : "s"}
                              {" · "}
                              <span className="font-semibold">
                                Total Rs {selectedCollectTotal.toLocaleString("en-PK")}
                              </span>
                            </p>
                          ) : (
                            <p className="sm:col-span-2 text-sm text-[#a33b4a]">
                              Select at least one fee type above.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div>
                    <label htmlFor="rollNumber" className="mb-1.5 block text-sm font-medium text-navy">
                      Roll Number <span className="text-[#a33b4a]">*</span>
                    </label>
                    <input
                      id="rollNumber"
                      name="rollNumber"
                      required
                      value={form.rollNumber}
                      onChange={handleChange}
                      readOnly={!editing && rollMeta.hasStudents && Boolean(form.rollNumber)}
                      placeholder={
                        rollMeta.isFirstStudent
                          ? "Enter first roll (e.g. 9501)"
                          : "Auto-filled — next roll"
                      }
                      className={[
                        inputClass,
                        !editing && rollMeta.hasStudents && form.rollNumber
                          ? "bg-lavender/15"
                          : "",
                      ].join(" ")}
                    />
                    <p className="mt-1 text-xs text-slate">
                      {rollMeta.isFirstStudent
                        ? "First student in this section — enter starting roll yourself (e.g. 9501). Next adds auto-increment."
                        : "Auto-filled from last roll in this section (e.g. 9501 → 9502)."}
                    </p>
                  </div>
                </div>
              </section>

              {customFieldDefs.length > 0 ? (
                <section className="space-y-4">
                  <h3 className="font-display text-sm font-semibold tracking-wide text-slate uppercase">
                    Custom fields
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {customFieldDefs.map((field) => (
                      <div
                        key={field._id}
                        className={
                          field.type === "textarea" || field.type === "radio"
                            ? "sm:col-span-2"
                            : ""
                        }
                      >
                        <label className="mb-1.5 block text-sm font-medium text-navy">
                          {field.label}{" "}
                          {field.required ? <span className="text-[#a33b4a]">*</span> : null}
                        </label>
                        {renderCustomInput(field)}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {editing ? (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-navy">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={form.isActive}
                    onChange={handleChange}
                    className="size-4 rounded border-rose/60"
                  />
                  Active student
                </label>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-rose/30 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  className="min-h-11 w-full cursor-pointer rounded-xl border border-rose/50 px-4 py-2.5 text-sm font-semibold text-navy transition hover:bg-blush sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-11 w-full cursor-pointer rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-blush transition hover:bg-slate disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {submitting
                    ? "Saving..."
                    : editing
                      ? "Update Student"
                      : "Add Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPrintForm && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-navy/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="print-form-title"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-rose/40 bg-white p-4 shadow-[0_20px_50px_rgb(31_34_50_/0.25)] sm:rounded-3xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 id="print-form-title" className="font-display text-2xl font-semibold text-navy">
                  Print student lists
                </h2>
                <p className="text-sm text-slate">
                  Select any classes or sections — print all in one click (each section on a new page).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintForm(false)}
                className="cursor-pointer rounded-xl p-2 text-slate transition hover:bg-blush"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handlePrintSubmit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block sm:col-span-1">
                  <span className="mb-1.5 block text-sm font-semibold text-navy">List title</span>
                  <input
                    type="text"
                    value={printMeta.title}
                    onChange={(e) =>
                      setPrintMeta((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="Student List"
                    className="min-h-11 w-full rounded-xl border border-rose/40 bg-white px-3 py-2 text-sm text-navy outline-none transition focus:border-navy"
                  />
                </label>
                <label className="block sm:col-span-1">
                  <span className="mb-1.5 block text-sm font-semibold text-navy">Subject</span>
                  <input
                    type="text"
                    value={printMeta.subject}
                    onChange={(e) =>
                      setPrintMeta((prev) => ({ ...prev, subject: e.target.value }))
                    }
                    placeholder="e.g. English"
                    className="min-h-11 w-full rounded-xl border border-rose/40 bg-white px-3 py-2 text-sm text-navy outline-none transition focus:border-navy"
                  />
                </label>
                <label className="block sm:col-span-1">
                  <span className="mb-1.5 block text-sm font-semibold text-navy">Exam / Test</span>
                  <input
                    type="text"
                    value={printMeta.exam}
                    onChange={(e) =>
                      setPrintMeta((prev) => ({ ...prev, exam: e.target.value }))
                    }
                    placeholder="e.g. Class Test"
                    className="min-h-11 w-full rounded-xl border border-rose/40 bg-white px-3 py-2 text-sm text-navy outline-none transition focus:border-navy"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-navy">
                  {printSelectedIds.length} section{printSelectedIds.length === 1 ? "" : "s"} selected
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllPrintSections}
                    className="cursor-pointer rounded-lg border border-rose/40 px-3 py-1.5 text-xs font-semibold text-navy transition hover:bg-blush"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={clearPrintSelection}
                    className="cursor-pointer rounded-lg border border-rose/40 px-3 py-1.5 text-xs font-semibold text-navy transition hover:bg-blush"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="max-h-[42vh] space-y-3 overflow-y-auto rounded-2xl border border-rose/30 bg-blush/20 p-3">
                {printSectionsByClass.map((group) => {
                  const ids = group.sections.map((s) => s._id);
                  const selectedCount = ids.filter((id) =>
                    printSelectedIds.includes(id)
                  ).length;
                  const allOn = selectedCount === ids.length;
                  const someOn = selectedCount > 0 && !allOn;

                  return (
                    <div
                      key={group.classId}
                      className="rounded-xl border border-rose/30 bg-white p-3"
                    >
                      <label className="flex cursor-pointer items-center gap-2.5 border-b border-rose/20 pb-2.5">
                        <input
                          type="checkbox"
                          checked={allOn}
                          ref={(el) => {
                            if (el) el.indeterminate = someOn;
                          }}
                          onChange={() => togglePrintClass(ids)}
                          className="size-4 accent-navy"
                        />
                        <span className="font-display text-base font-semibold text-navy">
                          {group.className}
                        </span>
                        <span className="text-xs text-slate">
                          {selectedCount}/{ids.length} sections
                        </span>
                      </label>

                      <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                        {group.sections.map((section) => {
                          const checked = printSelectedIds.includes(section._id);
                          return (
                            <label
                              key={section._id}
                              className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                                checked ? "bg-blush/60 font-semibold text-navy" : "text-slate hover:bg-blush/40"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePrintSection(section._id)}
                                className="size-4 accent-navy"
                              />
                              Section {section.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowPrintForm(false)}
                  className="min-h-11 w-full cursor-pointer rounded-xl border border-rose/50 px-4 py-2.5 text-sm font-semibold text-navy transition hover:bg-blush sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={printSelectedIds.length === 0}
                  className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-blush transition hover:bg-slate disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  <Printer className="size-4" aria-hidden="true" />
                  {printSelectedIds.length <= 1
                    ? "Continue"
                    : `Print ${printSelectedIds.length} lists`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFieldManager && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-navy/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="custom-fields-title"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-rose/40 bg-white p-4 shadow-[0_20px_50px_rgb(31_34_50_/0.25)] sm:rounded-3xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="custom-fields-title"
                  className="font-display text-2xl font-semibold text-navy"
                >
                  Custom Fields
                </h2>
                <p className="text-sm text-slate">
                  These fields appear on every Add / Edit Student form.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFieldManager(false)}
                className="cursor-pointer rounded-xl p-2 text-slate transition hover:bg-blush"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            {customFieldDefs.length > 0 ? (
              <div className="mb-5 sms-list">
                {customFieldDefs.map((field) => (
                  <div key={field._id} className="sms-row">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-navy">{field.label}</p>
                      <p className="text-xs text-slate">
                        {field.type}
                        {field.required ? " · required" : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomField(field)}
                      className="grid size-10 shrink-0 place-items-center rounded-xl text-[#a33b4a] transition hover:bg-rose/50"
                      aria-label={`Remove ${field.label}`}
                      title="Remove field"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-5 text-sm text-slate">No custom fields yet. Add one below.</p>
            )}

            <div className="rounded-2xl border border-dashed border-lavender/50 bg-bg-soft p-4">
              <h3 className="mb-3 font-display text-sm font-semibold tracking-wide text-slate uppercase">
                Add field
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-navy">Label *</label>
                  <input
                    value={fieldBuilder.label}
                    onChange={(e) =>
                      setFieldBuilder((prev) => ({ ...prev, label: e.target.value }))
                    }
                    className={inputClass}
                    placeholder="e.g. Previous school"
                  />
                </div>
                <CustomSelect
                  label="Input type"
                  searchable={false}
                  value={fieldBuilder.type}
                  options={FIELD_TYPE_OPTIONS}
                  onChange={(value) => setFieldBuilder((prev) => ({ ...prev, type: value }))}
                />
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-navy">Placeholder</label>
                  <input
                    value={fieldBuilder.placeholder}
                    onChange={(e) =>
                      setFieldBuilder((prev) => ({
                        ...prev,
                        placeholder: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </div>
                {["select", "radio"].includes(fieldBuilder.type) ? (
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-navy">
                      Options (comma or new line)
                    </label>
                    <textarea
                      rows={3}
                      value={fieldBuilder.optionsText}
                      onChange={(e) =>
                        setFieldBuilder((prev) => ({
                          ...prev,
                          optionsText: e.target.value,
                        }))
                      }
                      className={`${inputClass} resize-y`}
                      placeholder="Option A, Option B"
                    />
                  </div>
                ) : null}
                {["number", "range"].includes(fieldBuilder.type) ? (
                  <>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-navy">Min</label>
                      <input
                        type="number"
                        value={fieldBuilder.min}
                        onChange={(e) =>
                          setFieldBuilder((prev) => ({ ...prev, min: e.target.value }))
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-navy">Max</label>
                      <input
                        type="number"
                        value={fieldBuilder.max}
                        onChange={(e) =>
                          setFieldBuilder((prev) => ({ ...prev, max: e.target.value }))
                        }
                        className={inputClass}
                      />
                    </div>
                  </>
                ) : null}
                <label className="flex items-center gap-2 text-sm text-navy sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={fieldBuilder.required}
                    onChange={(e) =>
                      setFieldBuilder((prev) => ({
                        ...prev,
                        required: e.target.checked,
                      }))
                    }
                  />
                  Required on student form
                </label>
              </div>
              <button
                type="button"
                disabled={savingField}
                onClick={handleCreateCustomField}
                className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-navy px-4 text-sm font-semibold text-blush disabled:opacity-60"
              >
                {savingField ? "Saving…" : "Save field"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewStudent && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-navy/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-rose/40 bg-white p-4 shadow-[0_20px_50px_rgb(31_34_50_/0.25)] sm:rounded-3xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-semibold text-navy">
                  {viewStudent.name}
                </h2>
                <p className="mt-1 text-sm text-slate">
                  Roll #{viewStudent.rollNumber}
                  {viewStudent.session ? ` · ${viewStudent.session}` : ""}
                  {viewStudent.isActive === false ? " · Inactive" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewStudent(null)}
                className="cursor-pointer rounded-xl p-2 text-slate transition hover:bg-blush"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-blush px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-navy">
                {majorLabel(viewStudent.major)}
              </span>
              <span className="rounded-md bg-lavender/25 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-navy">
                {groupLabel(viewStudent.group)}
              </span>
              <span className="rounded-md bg-navy/90 px-2 py-1 text-[11px] font-bold tracking-wide text-blush">
                {viewStudent.class?.name || "Class"} · {viewStudent.section?.name || "Section"}
              </span>
              <button
                type="button"
                onClick={() => goToStudentFees(viewStudent)}
                className="ml-auto inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-navy px-2.5 text-[11px] font-semibold text-white transition hover:bg-navy/90"
              >
                <Receipt className="size-3.5 shrink-0" aria-hidden="true" />
                Fee details
              </button>
            </div>

            <dl className="grid gap-0 overflow-hidden rounded-2xl border border-rose/30 text-sm">
              {[
                ["Father name", viewStudent.fatherName],
                ["Gender", viewStudent.gender],
                ["Date of birth", toDateInput(viewStudent.dateOfBirth) || "—"],
                ["Phone", viewStudent.phone],
                ["Guardian phone", viewStudent.guardianPhone || "—"],
                ["Email", viewStudent.email || "—"],
                ["CNIC / B-Form", viewStudent.cnicOrBForm || "—"],
                ["Blood group", viewStudent.bloodGroup || "—"],
                ["Address", viewStudent.address || "—"],
                ["Admission date", toDateInput(viewStudent.admissionDate) || "—"],
                [
                  "Monthly fee",
                  viewStudent.monthlyFee != null ? `Rs ${viewStudent.monthlyFee}` : "—",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="grid gap-1 border-b border-rose/20 px-3 py-2.5 last:border-b-0 sm:grid-cols-[9rem_1fr] sm:gap-3"
                >
                  <dt className="text-slate">{label}</dt>
                  <dd className="font-medium break-words text-navy">{value}</dd>
                </div>
              ))}
              {Object.entries(viewStudent.customFields || {}).map(([key, value]) => {
                const def = customFieldDefs.find((field) => field.key === key);
                const label = def?.label || key;
                let display = "—";
                if (value && typeof value === "object" && value.url) {
                  display = (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await openProtectedUpload(value.url);
                        } catch {
                          toast.error("Could not open file");
                        }
                      }}
                      className="cursor-pointer underline"
                    >
                      {value.originalName || "View file"}
                    </button>
                  );
                } else if (typeof value === "boolean") {
                  display = value ? "Yes" : "No";
                } else if (value != null && value !== "") {
                  display = String(value);
                }
                return (
                  <div
                    key={key}
                    className="grid gap-1 border-b border-rose/20 px-3 py-2.5 last:border-b-0 sm:grid-cols-[9rem_1fr] sm:gap-3"
                  >
                    <dt className="text-slate">{label}</dt>
                    <dd className="font-medium break-words text-navy">{display}</dd>
                  </div>
                );
              })}
            </dl>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setViewStudent(null)}
                className="min-h-11 w-full cursor-pointer rounded-xl border border-rose/50 px-4 py-2.5 text-sm font-semibold text-navy transition hover:bg-blush sm:w-auto"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const student = viewStudent;
                  setViewStudent(null);
                  openEdit(student);
                }}
                className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl border border-rose/50 px-4 py-2.5 text-sm font-semibold text-navy transition hover:bg-blush sm:w-auto"
              >
                Edit
              </button>
              {canPromoteStudent(viewStudent) ? (
                <button
                  type="button"
                  onClick={() => startPromote(viewStudent)}
                  className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-blush transition hover:bg-slate sm:w-auto"
                >
                  Promote
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {promoteStudent && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-navy/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="promote-student-title"
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-rose/40 bg-white p-4 shadow-[0_20px_50px_rgb(31_34_50_/0.25)] sm:rounded-3xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="promote-student-title"
                  className="font-display text-2xl font-semibold text-navy"
                >
                  Promote Student
                </h2>
                <p className="text-sm text-slate">
                  {promoteStudent.name} · #{promoteStudent.rollNumber} ·{" "}
                  {promoteStudent.session || session}
                </p>
              </div>
              <button
                type="button"
                onClick={closePromote}
                className="cursor-pointer rounded-xl p-2 text-slate transition hover:bg-blush hover:text-navy"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handlePromote} className="space-y-4">
              <div>
                <p className="mb-1.5 text-sm font-medium text-navy">Next session</p>
                <p className="rounded-xl border border-rose/40 bg-bg-soft px-4 py-2.5 text-sm font-semibold text-navy">
                  {promoteForm.session}
                </p>
              </div>
              <CustomSelect
                id="promoteClass"
                label="Next class"
                required
                searchable={promoteClassOptions.length > 5}
                value={promoteForm.classId}
                options={promoteClassOptions}
                onChange={handlePromoteClassChange}
                placeholder="Select class"
              />
              <CustomSelect
                id="promoteSection"
                label="Section"
                required
                searchable={promoteSectionOptions.length > 5}
                value={promoteForm.sectionId}
                options={promoteSectionOptions}
                onChange={handlePromoteSectionChange}
                placeholder={promoteForm.classId ? "Select section" : "Select class first"}
                disabled={!promoteForm.classId}
              />
              <CustomSelect
                id="promoteGroup"
                label="Group"
                required
                searchable={false}
                value={promoteForm.group}
                options={promoteGroupOptions}
                onChange={(value) => setPromoteForm((prev) => ({ ...prev, group: value }))}
                placeholder="Select group"
                disabled={promoteGroupOptions.length === 0}
              />
              <div>
                <label htmlFor="promoteRoll" className="mb-1.5 block text-sm font-medium text-navy">
                  Roll number <span className="text-[#a33b4a]">*</span>
                </label>
                <input
                  id="promoteRoll"
                  required
                  value={promoteForm.rollNumber}
                  onChange={(e) =>
                    setPromoteForm((prev) => ({ ...prev, rollNumber: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="e.g. 10-Blue-01"
                />
              </div>
              <div>
                <label htmlFor="promoteFee" className="mb-1.5 block text-sm font-medium text-navy">
                  Monthly fee (Rs)
                </label>
                <input
                  id="promoteFee"
                  type="number"
                  min="0"
                  value={promoteForm.monthlyFee}
                  onChange={(e) =>
                    setPromoteForm((prev) => ({ ...prev, monthlyFee: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closePromote}
                  className="min-h-11 w-full cursor-pointer rounded-xl border border-rose/50 px-4 py-2.5 text-sm font-semibold text-navy transition hover:bg-blush sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={promoting}
                  className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-blush transition hover:bg-slate disabled:opacity-60 sm:w-auto"
                >
                  {promoting ? "Promoting…" : "Confirm promote"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default AcademyStudents;
