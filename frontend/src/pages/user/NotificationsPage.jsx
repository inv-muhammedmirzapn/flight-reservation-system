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

const fmtDate = (iso, lang) => {
  const locale = lang === 'ja' ? 'ja-JP' : 'en-IN';
  return new Date(iso).toLocaleString(locale, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const getLocalizedNotification = (notif, t) => {
  let { title, message, notification_type: type } = notif;
  try {
    if (type === 'BOOKING_CONFIRMED') {
      title = t('booking.notif.bookingConfirmedTitle', 'Booking Confirmation');
      const match = message.match(/Dear (.*?),\s*Your booking for flight (.*?) from (.*?) to (.*?) is confirmed!\s*Safe travels!/);
      if (match) message = t('booking.notif.bookingConfirmedMsg', 'Dear {{name}},\n\nYour booking for flight {{flight}} from {{source}} to {{dest}} is confirmed!\n\nSafe travels!', { name: match[1], flight: match[2], source: match[3], dest: match[4] });
    } else if (type === 'BOOKING_CANCELLED') {
      title = t('booking.notif.bookingCancelledTitle', 'Booking Cancellation');
      const match = message.match(/Dear (.*?),\s*Your booking for flight (.*?) from (.*?) to (.*?) has been successfully cancelled\.\s*We hope to see you again soon\./);
      if (match) message = t('booking.notif.bookingCancelledMsg', 'Dear {{name}},\n\nYour booking for flight {{flight}} from {{source}} to {{dest}} has been successfully cancelled.\n\nWe hope to see you again soon.', { name: match[1], flight: match[2], source: match[3], dest: match[4] });
    } else if (type === 'WAITLIST_ALLOCATED') {
      title = t('booking.notif.waitlistTitle', 'Waitlist Confirmation: You are booked!');
      const match = message.match(/Great news, (.*?)!\s*A seat became available on flight (.*?) from (.*?) to (.*?) and your waitlist entry was automatically upgraded to a confirmed booking\.\s*Enjoy your flight!/);
      if (match) message = t('booking.notif.waitlistMsg', 'Great news, {{name}}!\n\nA seat became available on flight {{flight}} from {{source}} to {{dest}} and your waitlist entry was automatically upgraded to a confirmed booking.\n\nEnjoy your flight!', { name: match[1], flight: match[2], source: match[3], dest: match[4] });
    } else if (type === 'FLIGHT_DELAYED') {
      const titleMatch = title.match(/Flight Delayed: (.*)/);
      if (titleMatch) title = t('booking.notif.flightDelayedTitle', 'Flight Delayed: {{flight}}', { flight: titleMatch[1] });
      const match = message.match(/Important update regarding your flight (.*?) from (.*?) to (.*?)\. The flight has been delayed and is now scheduled to depart at (.*?)\./);
      if (match) message = t('booking.notif.flightDelayedMsg', 'Important update regarding your flight {{flight}} from {{source}} to {{dest}}. The flight has been delayed and is now scheduled to depart at {{time}}.', { flight: match[1], source: match[2], dest: match[3], time: match[4] });
    } else if (type === 'FLIGHT_CANCELLED') {
      const titleMatch = title.match(/Flight Cancelled: (.*)/);
      if (titleMatch) title = t('booking.notif.flightCancelledTitle', 'Flight Cancelled: {{flight}}', { flight: titleMatch[1] });
      const match = message.match(/We regret to inform you that your flight (.*?) from (.*?) to (.*?) has been cancelled\. Please contact support for rebooking or refunds\./);
      if (match) message = t('booking.notif.flightCancelledMsg', 'We regret to inform you that your flight {{flight}} from {{source}} to {{dest}} has been cancelled. Please contact support for rebooking or refunds.', { flight: match[1], source: match[2], dest: match[3] });
    } else if (type === 'FLIGHT_BOARDING') {
      const titleMatch = title.match(/Flight Boarding: (.*)/);
      if (titleMatch) title = t('booking.notif.flightBoardingTitle', 'Flight Boarding: {{flight}}', { flight: titleMatch[1] });
      const match = message.match(/Flight (.*?) from (.*?) to (.*?) is now boarding\. Please proceed to the boarding gate\./);
      if (match) message = t('booking.notif.flightBoardingMsg', 'Flight {{flight}} from {{source}} to {{dest}} is now boarding. Please proceed to the boarding gate.', { flight: match[1], source: match[2], dest: match[3] });
    } else if (type === 'FLIGHT_DEPARTED') {
      const titleMatch = title.match(/Flight Departed: (.*)/);
      if (titleMatch) title = t('booking.notif.flightDepartedTitle', 'Flight Departed: {{flight}}', { flight: titleMatch[1] });
      const match = message.match(/Flight (.*?) from (.*?) to (.*?) has departed\./);
      if (match) message = t('booking.notif.flightDepartedMsg', 'Flight {{flight}} from {{source}} to {{dest}} has departed.', { flight: match[1], source: match[2], dest: match[3] });
    } else if (type === 'FLIGHT_ARRIVED') {
      const titleMatch = title.match(/Flight Arrived: (.*)/);
      if (titleMatch) title = t('booking.notif.flightArrivedTitle', 'Flight Arrived: {{flight}}', { flight: titleMatch[1] });
      const match = message.match(/Flight (.*?) from (.*?) to (.*?) has arrived safely\./);
      if (match) message = t('booking.notif.flightArrivedMsg', 'Flight {{flight}} from {{source}} to {{dest}} has arrived safely.', { flight: match[1], source: match[2], dest: match[3] });
    }
  } catch(e) {}
  return { title, message };
};

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
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const { list, listLoading, listError, unreadCount } = useSelector((state) => state.notifications);
  const [filter, setFilter] = useState('all'); // 'all' or 'unread'

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  const handleMarkRead = (id) => {
    dispatch(markNotificationRead(id))
      .unwrap()
      .then(() => toast.success(t('booking.notificationMarkedRead', 'Notification marked as read')))
      .catch((err) => toast.error(err));
  };

  const handleMarkAllRead = () => {
    dispatch(markAllNotificationsRead())
      .unwrap()
      .then(() => toast.success(t('booking.allNotificationsMarkedRead', 'All notifications marked as read')))
      .catch((err) => toast.error(err));
  };

  const filteredNotifications = list.filter((n) => {
    if (filter === 'unread') return !n.is_read;
    return true;
  });

  return (
    <div style={{
      padding: '120px 24px 48px',
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
              letterSpacing: '-0.02em',
              margin: 0,
            }}>
              {t('booking.notificationsTitle', 'Notifications')}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.9rem', opacity: 0.8 }}>
              {t('booking.notificationsSubtitle', 'Stay updated with real-time flight status alerts.')}
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
              {t('booking.markAllRead', 'Mark All as Read')}
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
              color: 'inherit',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {t('booking.all', 'All')} ({list.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            style={{
              padding: '8px 16px',
              borderRadius: '9999px',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              background: filter === 'unread' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.4)',
              color: 'inherit',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {t('booking.unread', 'Unread')} ({unreadCount})
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
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 4px' }}>
                {t('booking.noNotifications', 'No notifications yet')}
              </h3>
              <p style={{ fontSize: '0.875rem', opacity: 0.8, maxWidth: '320px', margin: 0 }}>
                {t('booking.noNotificationsDesc', "We'll let you know when there are updates regarding your flights.")}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredNotifications.map((notif) => {
                const styles = getNotificationStyles(notif.notification_type);
                const { title, message } = getLocalizedNotification(notif, t);
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
                        margin: '0 0 4px',
                      }}>
                        {title}
                      </h4>
                      <p style={{
                        fontSize: '0.875rem',
                        opacity: 0.8,
                        lineHeight: 1.5,
                        margin: '0 0 8px',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {message}
                      </p>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        color: '#9ca3af',
                      }}>
                        <Calendar size={12} />
                        <span>{fmtDate(notif.created_at, i18n.language)}</span>
                      </div>
                    </div>

                    {/* Mark as read action button */}
                    {!notif.is_read && (
                      <button
                        data-testid={`mark-read-${notif.id}`}
                        onClick={() => handleMarkRead(notif.id)}
                        title={t('booking.markAsRead', 'Mark as Read')}
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
