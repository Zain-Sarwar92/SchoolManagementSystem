import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ModuleRoute from "./components/ModuleRoute.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import SuperAdminDashboard from "./pages/SuperAdminDashboard.jsx";
import AcademyAdminDashboard from "./pages/AcademyAdminDashboard.jsx";
import AcademyClasses from "./pages/AcademyClasses.jsx";
import AcademySections from "./pages/AcademySections.jsx";
import AcademyStudents from "./pages/AcademyStudents.jsx";
import AcademyStudentListPrint from "./pages/AcademyStudentListPrint.jsx";
import AcademyStudentListPrintBatch from "./pages/AcademyStudentListPrintBatch.jsx";
import AcademyFees from "./pages/AcademyFees.jsx";
import AcademyFeeCollectStudent from "./pages/AcademyFeeCollectStudent.jsx";
import AcademyFeeDuesPrint from "./pages/AcademyFeeDuesPrint.jsx";
import AcademyResults from "./pages/AcademyResults.jsx";
import AcademyResultSection from "./pages/AcademyResultSection.jsx";
import AcademyResultExam from "./pages/AcademyResultExam.jsx";
import AcademyResultMarks from "./pages/AcademyResultMarks.jsx";
import AcademyResultGazettePrint from "./pages/AcademyResultGazettePrint.jsx";
import AcademyResultCompilePrint from "./pages/AcademyResultCompilePrint.jsx";
import AcademyResultStudentPrint from "./pages/AcademyResultStudentPrint.jsx";
import AcademyTeachers from "./pages/AcademyTeachers.jsx";
import AcademySchedules from "./pages/AcademySchedules.jsx";
import AcademyScheduleNew from "./pages/AcademyScheduleNew.jsx";
import AcademySchedulePrint from "./pages/AcademySchedulePrint.jsx";
import TeacherDashboard from "./pages/TeacherDashboard.jsx";
import TeacherSchedules from "./pages/TeacherSchedules.jsx";
import {
  GeneratorCreate,
  GeneratorPapers,
  GeneratorPaperView,
  GeneratorPrintPaper,
  GeneratorActivities,
  GeneratorSubAccounts,
  GeneratorSettings,
} from "./features/generator/index.js";
import { academyHasModule } from "./utils/academyModules.js";

function roleHome(role, user) {
  if (role === "super_admin") return "/super-admin";
  /* TG sub accounts always land in Test Generator */
  if (role === "sub_account") return "/academy/generator";
  if (role === "teacher") {
    if (
      academyHasModule(user?.academy, "TEST_GENERATOR") &&
      !academyHasModule(user?.academy, "ACADEMY_MANAGEMENT")
    ) {
      return "/academy/generator";
    }
    return "/teacher";
  }
  return "/academy";
}

function HomeRedirect() {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-slate">Loading...</div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={roleHome(user.role, user)} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/super-admin"
        element={
          <ProtectedRoute roles={["super_admin"]}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <AcademyAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/classes"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <AcademyClasses />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/sections"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <AcademySections />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/teachers"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <AcademyTeachers />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/schedules"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <AcademySchedules />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/schedules/new"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <AcademyScheduleNew />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/schedules/:id"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <Navigate to="print" replace />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/schedules/:id/print"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <AcademySchedulePrint />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/generator"
        element={
          <ProtectedRoute roles={["academy_admin", "teacher", "sub_account"]}>
            <ModuleRoute module="TEST_GENERATOR">
              <GeneratorCreate />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/generator/papers"
        element={
          <ProtectedRoute roles={["academy_admin", "teacher", "sub_account"]}>
            <ModuleRoute module="TEST_GENERATOR">
              <GeneratorPapers />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/generator/papers/:id"
        element={
          <ProtectedRoute roles={["academy_admin", "teacher", "sub_account"]}>
            <ModuleRoute module="TEST_GENERATOR">
              <GeneratorPaperView />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/generator/print"
        element={
          <ProtectedRoute roles={["academy_admin", "teacher", "sub_account"]}>
            <ModuleRoute module="TEST_GENERATOR">
              <GeneratorPrintPaper />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/generator/activities"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="TEST_GENERATOR">
              <GeneratorActivities />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/generator/sub-accounts"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="TEST_GENERATOR">
              <GeneratorSubAccounts />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/generator/settings"
        element={
          <ProtectedRoute roles={["academy_admin", "teacher", "sub_account"]}>
            <ModuleRoute module="TEST_GENERATOR">
              <GeneratorSettings />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher"
        element={
          <ProtectedRoute roles={["teacher"]}>
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/schedules"
        element={
          <ProtectedRoute roles={["teacher"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <TeacherSchedules />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/students"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <AcademyStudents />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/students/print/:sectionId"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <AcademyStudentListPrint />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/students/print-batch"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <AcademyStudentListPrintBatch />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/fees"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <AcademyFees />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/fees/collect/:studentId"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <AcademyFeeCollectStudent />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/fees/print"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <AcademyFeeDuesPrint />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/results"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <AcademyResults />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/results/sections/:sectionId"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <AcademyResultSection />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/results/sections/:sectionId/exams/:examId"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <AcademyResultExam />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/results/assessments/:assessmentId/marks"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <AcademyResultMarks />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/results/sections/:sectionId/exams/:examId/gazette"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <AcademyResultGazettePrint />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/results/compile"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <AcademyResultCompilePrint />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academy/results/students/:studentId/print"
        element={
          <ProtectedRoute roles={["academy_admin"]}>
            <ModuleRoute module="ACADEMY_MANAGEMENT">
              <AcademyResultStudentPrint />
            </ModuleRoute>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
