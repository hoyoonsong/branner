import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Protected } from "./components/Protected";
import { AdminsRoute, HomeRedirect, StaffRoute } from "./components/StaffRoute";
import { Login } from "./pages/Login";
import { Pending } from "./pages/Pending";
import { Attendance } from "./pages/Attendance";
import { EventDetail } from "./pages/EventDetail";
import { Residents } from "./pages/Residents";
import { ResidentProfile } from "./pages/ResidentProfile";
import { RoommateContracts } from "./pages/RoommateContracts";
import { Birthdays } from "./pages/Birthdays";
import { MapPage } from "./pages/MapPage";
import { Admins } from "./pages/Admins";
import { PublicAttendance } from "./pages/PublicAttendance";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/pending" element={<Pending />} />
      <Route path="/a/:slug" element={<PublicAttendance />} />
      <Route element={<Protected />}>
        <Route element={<Layout />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route element={<StaffRoute page="attendance" />}>
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/attendance/:id" element={<EventDetail />} />
          </Route>
          <Route element={<StaffRoute page="residents" />}>
            <Route path="/residents" element={<Residents />} />
            <Route path="/residents/:id" element={<ResidentProfile />} />
          </Route>
          <Route element={<StaffRoute page="contracts" />}>
            <Route path="/contracts" element={<RoommateContracts />} />
          </Route>
          <Route element={<StaffRoute page="birthdays" />}>
            <Route path="/birthdays" element={<Birthdays />} />
          </Route>
          <Route element={<StaffRoute page="map" />}>
            <Route path="/map" element={<MapPage />} />
          </Route>
          <Route element={<AdminsRoute />}>
            <Route path="/admins" element={<Admins />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
