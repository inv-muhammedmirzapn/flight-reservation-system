import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/store/notificationsSlice';
import {
  Bell, BellRing, Check, CheckCheck, Loader,
  AlertCircle, Calendar, Clock, Plane, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';

const fmtDate = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

function getNotificationStyles(type) {
  const defaults = {
    bg: 'rgba(255, 255, 255, 0.4)',
    border: 'rgba(255, 255, 255, 0.5)',
    icon: <Bell size={18} className="text-gray-600" />,
  };

  const styles = {
    FLIGHT_DELAYED: {
      bg: 'rgba(254, 243, 199, 0.4)',
      border: 'rgba(252, 211, 77, 0.5)',
      icon: <Clock size={18} className="text-amber-600" />,
    },
    FLIGHT_CANCELLED: {
      bg: 'rgba(254, 242, 242, 0.4)',
      border: 'rgba(252, 165, 165, 0.5)',
      icon: <AlertCircle size={18} className="text-red-600" />,
    },
    FLIGHT_BOARDING: {
      bg: 'rgba(239, 246, 255, 0.4)',
      border: 'rgba(191, 219, 254, 0.5)',
      icon: <Plane size={18} className="text-blue-600 rotate-[-45deg]" />,
    },
    FLIGHT_DEPARTED: {
      bg: 'rgba(249, 250, 251, 0.4)',
      border: 'rgba(229, 231, 235, 0.5)',
      icon: <Plane size={18} className="text-gray-600 rotate-[-45deg]" />,
    },
    FLIGHT_ARRIVED: {
      bg: 'rgba(240, 253, 244, 0.4)',
      border: 'rgba(187, 247, 208, 0.5)',
      icon: <CheckCheck size={18} className="text-green-600" />,
    },
  };

  return styles[type] || defaults;
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { list, listLoading, listError, unreadCount } = useSelector((state) => state.notifications);
  const [filter, setFilter] = useState('all'); // 'all' or 'unread'

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  const handleMarkRead = (id) => {
    dispatch(markNotificationRead(id))
      .unwrap()
      .then(() => toast.success(t('notificationMarkedRead', 'Notification marked as read')))
      .catch((err) => toast.error(err));
  };

  const handleMarkAllRead = () => {
    dispatch(markAllNotificationsRead())
      .unwrap()
      .then(() => toast.success(t('allNotificationsMarkedRead', 'All notifications marked as read')))
      .catch((err) => toast.error(err));
  };

  const filteredNotifications = list.filter((n) => {
    if (filter === 'unread') return !n.is_read;
    return true;
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      padding: '120px 24px 48px',
      fontFamily: 'Inter, sans-serif',
      display: 'flex',
      justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: '800px' }}>
        {/* Header section */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: 800,
              color: '#1a1c1d',
              letterSpacing: '-0.02em',
              margin: 0,
            }}>
              {t('notificationsTitle', 'Notifications')}
            </h1>
            <p style={{ color: '#5e5e5e', margin: '4px 0 0', fontSize: '0.9rem' }}>
              {t('notificationsSubtitle', 'Stay updated with real-time flight status alerts.')}
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '12px',
                border: 'none',
                background: '#ffd700',
                color: '#1a1c1d',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(255, 215, 0, 0.2)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 215, 0, 0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.2)'; }}
            >
              <CheckCheck size={16} />
              {t('markAllRead', 'Mark All as Read')}
            </button>
          )}
        </div>

        {/* Filters/Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
        }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '8px 16px',
              borderRadius: '9999px',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              background: filter === 'all' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.4)',
              color: '#1a1c1d',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {t('all', 'All')} ({list.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            style={{
              padding: '8px 16px',
              borderRadius: '9999px',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              background: filter === 'unread' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.4)',
              color: '#1a1c1d',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {t('unread', 'Unread')} ({unreadCount})
          </button>
        </div>

        {/* Notification List Container */}
        <div className="glass-card" style={{
          borderRadius: '1.5rem',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.04)',
          position: 'relative',
        }}>
          {listLoading ? (
            <div data-testid="loading-spinner" style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '200px',
            }}>
              <Loader size={36} className="animate-spin text-[#705d00]" />
            </div>
          ) : listError ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '40px 20px',
              color: '#991b1b',
              textAlign: 'center',
            }}>
              <AlertCircle size={40} className="mb-2" />
              <p style={{ fontWeight: 600, margin: 0 }}>{listError}</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              textAlign: 'center',
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(255, 215, 0, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#705d00',
                marginBottom: '16px',
              }}>
                <Bell size={28} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1c1d', margin: '0 0 4px' }}>
                {t('noNotifications', 'No notifications yet')}
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#5e5e5e', maxWidth: '320px', margin: 0 }}>
                {t('noNotificationsDesc', "We'll let you know when there are updates regarding your flights.")}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredNotifications.map((notif) => {
                const styles = getNotificationStyles(notif.notification_type);
                return (
                  <div
                    key={notif.id}
                    className="glass-card"
                    style={{
                      borderRadius: '1rem',
                      padding: '16px 20px',
                      background: styles.bg,
                      borderColor: styles.border,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '16px',
                      opacity: notif.is_read ? 0.75 : 1,
                      transition: 'all 0.2s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    {/* Unread status dot indicator */}
                    {!notif.is_read && (
                      <span style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#ffd700',
                        boxShadow: '0 0 8px #ffd700',
                      }} />
                    )}

                    {/* Icon wrapper */}
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.72)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    }}>
                      {styles.icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, paddingRight: '24px' }}>
                      <h4 style={{
                        fontSize: '0.95rem',
                        fontWeight: notif.is_read ? 600 : 700,
                        color: '#1a1c1d',
                        margin: '0 0 4px',
                      }}>
                        {notif.title}
                      </h4>
                      <p style={{
                        fontSize: '0.875rem',
                        color: '#4b5563',
                        lineHeight: 1.5,
                        margin: '0 0 8px',
                      }}>
                        {notif.message}
                      </p>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        color: '#9ca3af',
                      }}>
                        <Calendar size={12} />
                        <span>{fmtDate(notif.created_at)}</span>
                      </div>
                    </div>

                    {/* Mark as read action button */}
                    {!notif.is_read && (
                      <button
                        data-testid={`mark-read-${notif.id}`}
                        onClick={() => handleMarkRead(notif.id)}
                        title={t('markAsRead', 'Mark as Read')}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '10px',
                          border: 'none',
                          background: 'rgba(255, 255, 255, 0.8)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: '#4b5563',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#ffd700'; e.currentTarget.style.color = '#1a1c1d'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)'; e.currentTarget.style.color = '#4b5563'; }}
                      >
                        <Check size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
