import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/store/notificationsSlice";
import toast from "react-hot-toast";
import { parseApiError } from "@/utils/errorUtils";

export default function NotificationsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { list, listLoading, listError, unreadCount } = useSelector(
    (state) => state?.notifications || { list: [], listLoading: false, listError: null, unreadCount: 0 }
  );

  const [activeTab, setActiveTab] = useState("ALL"); // "ALL" | "UNREAD"

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await dispatch(markNotificationRead(id)).unwrap();
    } catch (err) {
      toast.error(parseApiError(err, "Failed to mark as read"));
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      await dispatch(markAllNotificationsRead()).unwrap();
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error(parseApiError(err, "Failed to mark all as read"));
    }
  };

  const getNotificationLink = (item) => {
    if (item?.link) return item.link;

    const type = item?.notification_type || "";
    const relId = item?.related_object_id;

    if (type === "BOOKING_CONFIRMED" || type === "BOOKING_CANCELLED" || type === "WAITLIST_ALLOCATED") {
      return relId ? `/my-bookings/ticket/${relId}` : "/my-bookings";
    }

    if (type.startsWith("FLIGHT_")) {
      return relId ? `/flights/${relId}` : "/my-bookings";
    }

    const text = `${item?.title || ""} ${item?.message || ""}`.toLowerCase();
    if (text.includes("booking") || text.includes("ticket") || text.includes("waitlist")) {
      return "/my-bookings";
    }
    if (text.includes("flight") || text.includes("delay") || text.includes("schedule")) {
      return "/my-bookings";
    }

    return "/my-bookings";
  };

  const handleCardClick = async (item) => {
    if (!item.is_read) {
      handleMarkAsRead(item.id);
    }
    const targetLink = getNotificationLink(item);
    if (targetLink) {
      navigate(targetLink);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;

      const now = new Date();
      const diffMs = now - d;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;

      const day = d.getDate();
      const month = d.toLocaleString("en-US", { month: "short" });
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, "0");
      const mins = String(d.getMinutes()).padStart(2, "0");

      return `${day} ${month} ${year}, ${hours}:${mins}`;
    } catch (_) {
      return dateStr;
    }
  };

  const getNotificationIcon = (n) => {
    const text = `${n?.title || ""} ${n?.message || ""} ${n?.notification_type || ""}`.toLowerCase();
    if (text.includes("waitlist") || text.includes("queue")) return "hourglass_top";
    if (text.includes("cancel") || text.includes("refund")) return "cancel";
    if (text.includes("confirm") || text.includes("ticket") || text.includes("book")) return "airplane_ticket";
    if (text.includes("flight") || text.includes("delay") || text.includes("schedule")) return "flight_takeoff";
    return "notifications";
  };

  const filteredList = list.filter((item) => {
    if (activeTab === "UNREAD") return !item.is_read;
    return true;
  });

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-3.5rem)] flex flex-col items-center px-4 py-12 mt-12 bg-slate-50/60">
      {/* Sky-themed Soft Ambient Aesthetic Blobs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-sky-200/50 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 -right-20 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-1/4 w-72 h-72 bg-blue-100/60 rounded-full blur-3xl pointer-events-none" />

      {/* Page Title */}
      <h1 className="text-xl font-bold text-slate-950 w-full max-w-2xl mb-7 ml-5">
        Notifications
      </h1>

      {/* Main Container Card */}
      <div className="relative z-10 w-full max-w-2xl rounded-3xl px-8 pt-8 pb-12 sm:px-10 animate-fade-in plain-card space-y-6">
        
        {/* Top Header Controls: Tabs & Action Button */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          {/* Filter Tabs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeTab === "ALL"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              All ({list.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("UNREAD")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                activeTab === "UNREAD"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#ffd600] text-black font-extrabold flex items-center justify-center text-[9px]">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Mark All Read Button */}
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className="h-8 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-sm">done_all</span>
            <span>Mark all read</span>
          </button>
        </div>

        {/* Content Section */}
        {listLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : listError ? (
          <div className="p-8 text-center space-y-3">
            <span className="material-symbols-outlined text-3xl text-rose-500">error</span>
            <p className="text-sm font-semibold text-slate-700">{listError}</p>
            <button
              type="button"
              onClick={() => dispatch(fetchNotifications())}
              className="btn-secondary px-4 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 mt-2"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              <span>Try Again</span>
            </button>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-12 text-center space-y-4 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">notifications_off</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {activeTab === "UNREAD" ? "No Unread Notifications" : "No Notifications"}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {activeTab === "UNREAD"
                ? "You're all caught up! There are no unread alerts at the moment."
                : "When you receive flight updates or booking confirmations, they will appear here."}
            </p>
            {activeTab === "UNREAD" && list.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className="btn-secondary px-4 py-2 rounded-xl text-xs font-bold transition-all mt-2"
              >
                View all notifications
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredList.map((item) => {
              const isUnread = !item.is_read;
              const iconName = getNotificationIcon(item);

              return (
                <div
                  key={item.id}
                  onClick={() => handleCardClick(item)}
                  className={`group rounded-3xl p-4 sm:p-5 flex items-start gap-4 transition-all duration-200 cursor-pointer border ${
                    isUnread
                      ? "bg-amber-500/5 border-amber-300/60 shadow-xs hover:bg-amber-500/10 hover:border-amber-400"
                      : "bg-slate-50/70 border-slate-100 hover:bg-slate-100/80 hover:border-slate-300"
                  }`}
                >
                  {/* Icon Wrapper */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                      isUnread
                        ? "bg-[#ffd600] text-slate-950 shadow-xs"
                        : "bg-slate-200/70 text-slate-500 group-hover:bg-slate-300/70"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl select-none">
                      {iconName}
                    </span>
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className={`text-xs sm:text-sm truncate ${isUnread ? "font-bold text-slate-950" : "font-semibold text-slate-700"}`}>
                        {item.title || item.notification_type || "Notification"}
                      </h4>
                      <span className="text-[10px] font-medium text-slate-400 flex-shrink-0">
                        {formatDate(item.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed break-words">
                      {item.message || item.content || "-"}
                    </p>
                  </div>

                  {/* Unread Action & Arrow Navigation Indicator */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 self-center">
                    {isUnread && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(item.id, e)}
                        className="w-7 h-7 rounded-lg hover:bg-amber-200/50 flex items-center justify-center text-amber-700 transition-colors"
                        title="Mark as read"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs" />
                      </button>
                    )}
                    <span className="material-symbols-outlined text-lg text-slate-400 group-hover:text-slate-800 group-hover:translate-x-0.5 transition-all select-none">
                      chevron_right
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
