import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchFlightDetail, addFlight, updateFlight, clearFlightErrors, clearFlightDetail } from '../../store/flightSlice';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import DateTimePicker from '../../components/ui/DateTimePicker';
import { ArrowLeft, Save, X, Plane, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const getStatusOpts = (t) => [
  { value: 'SCHEDULED', label: t("flights.status_SCHEDULED", { defaultValue: 'Scheduled' }) },
  { value: 'DELAYED', label: t("flights.status_DELAYED", { defaultValue: 'Delayed' }) },
  { value: 'CANCELLED', label: t("flights.status_CANCELLED", { defaultValue: 'Cancelled' }) },
  { value: 'BOARDING', label: t("flights.status_BOARDING", { defaultValue: 'Boarding' }) },
  { value: 'DEPARTED', label: t("flights.status_DEPARTED", { defaultValue: 'Departed' }) },
  { value: 'ARRIVED', label: t("flights.status_ARRIVED", { defaultValue: 'Arrived' }) },
];

const EMPTY_FORM = {
  flight_number: '',
  airline: '',
  aircraft: '',
  source_airport: '',
  destination_airport: '',
  departure_time: '',
  arrival_time: '',
  base_fare: '',
  total_seats: '',
  available_seats: '',
  status: 'SCHEDULED',
};

export default function AdminFlightForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { detail: flight, detailLoading, actionLoading, validationErrors } = useSelector(state => state.flights);

  const [form, setForm] = useState(EMPTY_FORM);
  const [localErrors, setLocalErrors] = useState({});

  // Fetch details if editing
  useEffect(() => {
    if (isEdit) {
      dispatch(fetchFlightDetail(id));
    } else {
      dispatch(clearFlightDetail());
      setForm(EMPTY_FORM);
    }
    dispatch(clearFlightErrors());
    return () => {
      dispatch(clearFlightErrors());
    };
  }, [dispatch, id, isEdit]);

  // Populate form if details loaded
  useEffect(() => {
    if (isEdit && flight) {
      setForm({
        flight_number: flight.flight_number || '',
        airline: flight.airline || '',
        aircraft: flight.aircraft || '',
        source_airport: flight.source_airport || '',
        destination_airport: flight.destination_airport || '',
        departure_time: flight.departure_time || '',
        arrival_time: flight.arrival_time || '',
        base_fare: flight.base_fare || '',
        total_seats: flight.total_seats || '',
        available_seats: flight.available_seats || '',
        status: flight.status || 'SCHEDULED',
      });
    }
  }, [flight, isEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let val = value;
    if (name === 'source_airport' || name === 'destination_airport') {
      val = value.toUpperCase().trim();
    }
    setForm(prev => ({ ...prev, [name]: val }));
    if (localErrors[name]) {
      setLocalErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleDateChange = (name, isoString) => {
    setForm(prev => ({ ...prev, [name]: isoString }));
    if (localErrors[name]) {
      setLocalErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!form.flight_number) errors.flight_number = 'Flight number is required.';
    if (!form.airline) errors.airline = 'Airline is required.';
    if (!form.aircraft) errors.aircraft = 'Aircraft is required.';
    if (!form.source_airport) errors.source_airport = 'Source airport is required.';
    if (!form.destination_airport) errors.destination_airport = 'Destination airport is required.';
    if (!form.departure_time) errors.departure_time = 'Departure time is required.';
    if (!form.arrival_time) errors.arrival_time = 'Arrival time is required.';
    if (form.base_fare === '') errors.base_fare = 'Base fare is required.';
    if (form.total_seats === '') errors.total_seats = 'Total seats is required.';
    if (form.available_seats === '') errors.available_seats = 'Available seats is required.';

    if (form.source_airport && form.destination_airport && form.source_airport === form.destination_airport) {
      errors.destination_airport = 'Source and destination airports cannot be identical.';
    }

    if (form.departure_time && form.arrival_time) {
      if (new Date(form.arrival_time) <= new Date(form.departure_time)) {
        errors.arrival_time = 'Arrival time must be later than departure time.';
      }
    }

    if (form.base_fare !== '' && Number(form.base_fare) < 0) {
      errors.base_fare = 'Base fare cannot be negative.';
    }

    if (form.total_seats !== '' && Number(form.total_seats) < 0) {
      errors.total_seats = 'Total seats cannot be negative.';
    }

    if (form.available_seats !== '' && Number(form.available_seats) < 0) {
      errors.available_seats = 'Available seats cannot be negative.';
    }

    if (form.total_seats !== '' && form.available_seats !== '' && Number(form.available_seats) > Number(form.total_seats)) {
      errors.available_seats = 'Available seats cannot exceed total seats.';
    }

    setLocalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please correct the validation errors in the form.');
      return;
    }

    const payload = {
      ...form,
      base_fare: Number(form.base_fare),
      total_seats: Number(form.total_seats),
      available_seats: Number(form.available_seats),
    };

    let resultPromise;
    if (isEdit) {
      resultPromise = dispatch(updateFlight({ id, flightData: payload })).unwrap();
    } else {
      resultPromise = dispatch(addFlight(payload)).unwrap();
    }

    toast.promise(resultPromise, {
      loading: isEdit ? 'Updating flight route…' : 'Creating flight route…',
      success: () => {
        navigate('/admin/flights');
        return isEdit ? 'Flight route updated successfully!' : 'Flight route added successfully!';
      },
      error: (err) => {
        if (err && typeof err === 'object' && !err.non_field_errors) {
          return 'Validation failed. Please check form fields.';
        }
        return err?.non_field_errors?.[0] || 'Failed to save flight route.';
      }
    });
  };

  if (isEdit && detailLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ width: 44, height: 44, border: '3px solid rgba(112,93,0,0.15)', borderTopColor: '#705d00', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
      </div>
    );
  }

  return (
    <>
      <style>{`
        .back-lnk:hover { color: #705d00 !important; }
        .section-container {
          padding: 24px 0;
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .section-container:last-child {
          border-bottom: none;
        }
        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 20px;
          margin-top: 16px;
        }
      `}</style>

      <div style={{ maxWidth: 840, margin: '0 auto', padding: '88px 24px 48px' }}>
        {/* Back Link */}
        <Link to="/admin/flights" className="back-lnk" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#1a1c1d', fontWeight: 700, textDecoration: 'none', fontSize: 14, marginBottom: 24, transition: 'color 0.2s' }}>
          <ArrowLeft size={16} /> {t("admin.form.backToConsole", { defaultValue: 'Back to Console' })}
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 32, fontWeight: 800, color: '#1a1c1d', letterSpacing: '-0.02em', margin: 0 }}>
              {isEdit ? t("admin.form.editTitle", { defaultValue: 'Edit Flight Route' }) : t("admin.form.addTitle", { defaultValue: 'Add Flight Route' })}
            </h1>
            <p style={{ fontSize: 14, color: '#5e5e5e', marginTop: 4, margin: 0 }}>
              {isEdit ? t("admin.form.editSubtitle", { flightNumber: form.flight_number, defaultValue: `Modifying flight details for route ${form.flight_number}` }) : t("admin.form.addSubtitle", { defaultValue: 'Manually configure a new flight route' })}
            </p>
          </div>
        </div>

        {/* Global errors */}
        {validationErrors?.non_field_errors && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '16px 20px', color: '#b91c1c', marginBottom: 24, fontSize: 14 }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div>
              {validationErrors.non_field_errors.map((err, i) => <div key={i}>{err}</div>)}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="glass-card" style={{ borderRadius: 28, padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          
          {/* Section 1: Flight General Info */}
          <div className="section-container">
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#705d00', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plane size={16} /> {t("admin.form.generalInfo", { defaultValue: 'General Information' })}
            </h3>
            <div className="form-grid">
              <Input
                id="flight_number"
                label={t("admin.form.flightNumber", { defaultValue: 'Flight Number' })}
                placeholder="e.g. AG-102"
                value={form.flight_number}
                onChange={handleChange}
                disabled={isEdit} // Flight number is unique and typically key/read-only on edit
                error={validationErrors?.flight_number?.[0] || localErrors.flight_number}
              />
              <Input
                id="airline"
                label={t("admin.form.airline", { defaultValue: 'Airline' })}
                placeholder="e.g. AeroGlass Premium"
                value={form.airline}
                onChange={handleChange}
                error={validationErrors?.airline?.[0] || localErrors.airline}
              />
              <Input
                id="aircraft"
                label={t("admin.form.aircraftModel", { defaultValue: 'Aircraft Model' })}
                placeholder="e.g. Boeing 787"
                value={form.aircraft}
                onChange={handleChange}
                error={validationErrors?.aircraft?.[0] || localErrors.aircraft}
              />
              <Select
                id="status"
                label={t("admin.form.status", { defaultValue: 'Status' })}
                options={getStatusOpts(t)}
                value={form.status}
                onChange={handleChange}
                error={validationErrors?.status?.[0] || localErrors.status}
              />
            </div>
          </div>

          {/* Section 2: Route Settings */}
          <div className="section-container">
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#705d00' }}>
              {t("admin.form.routeInfo", { defaultValue: 'Route Information' })}
            </h3>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              <Input
                id="source_airport"
                label={t("admin.form.sourceCode", { defaultValue: 'Source Airport Code (From)' })}
                placeholder="e.g. MIA"
                value={form.source_airport}
                onChange={handleChange}
                error={validationErrors?.source_airport?.[0] || localErrors.source_airport}
              />
              <Input
                id="destination_airport"
                label={t("admin.form.destCode", { defaultValue: 'Destination Airport Code (To)' })}
                placeholder="e.g. LAX"
                value={form.destination_airport}
                onChange={handleChange}
                error={validationErrors?.destination_airport?.[0] || localErrors.destination_airport}
              />
            </div>
          </div>

          {/* Section 3: Schedule */}
          <div className="section-container">
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#705d00' }}>
              {t("admin.form.scheduleSettings", { defaultValue: 'Schedule Settings' })}
            </h3>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5e5e5e', display: 'block', marginBottom: 6 }}>
                  {t("admin.form.departureTime", { defaultValue: 'Departure Time' })}
                </label>
                <DateTimePicker
                  value={form.departure_time}
                  onChange={(iso) => handleDateChange('departure_time', iso)}
                  data-testid="departure-time-picker"
                />
                {localErrors.departure_time && (
                  <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 4, paddingLeft: 2 }}>{localErrors.departure_time}</p>
                )}
                {validationErrors?.departure_time?.[0] && (
                  <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 4, paddingLeft: 2 }}>{validationErrors.departure_time[0]}</p>
                )}
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5e5e5e', display: 'block', marginBottom: 6 }}>
                  {t("admin.form.arrivalTime", { defaultValue: 'Arrival Time' })}
                </label>
                <DateTimePicker
                  value={form.arrival_time}
                  onChange={(iso) => handleDateChange('arrival_time', iso)}
                  data-testid="arrival-time-picker"
                />
                {localErrors.arrival_time && (
                  <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 4, paddingLeft: 2 }}>{localErrors.arrival_time}</p>
                )}
                {validationErrors?.arrival_time?.[0] && (
                  <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 4, paddingLeft: 2 }}>{validationErrors.arrival_time[0]}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Seating & Pricing */}
          <div className="section-container">
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#705d00' }}>
              {t("admin.form.pricingCapacity", { defaultValue: 'Pricing & Capacity' })}
            </h3>
            <div className="form-grid">
              <Input
                id="base_fare"
                type="number"
                label={t("admin.form.baseFare", { defaultValue: 'Base Fare (INR)' })}
                placeholder="e.g. 5000"
                value={form.base_fare}
                onChange={handleChange}
                error={validationErrors?.base_fare?.[0] || localErrors.base_fare}
              />
              <Input
                id="total_seats"
                type="number"
                label={t("admin.form.totalSeats", { defaultValue: 'Total Seats Capacity' })}
                placeholder="e.g. 180"
                value={form.total_seats}
                onChange={handleChange}
                error={validationErrors?.total_seats?.[0] || localErrors.total_seats}
              />
              <Input
                id="available_seats"
                type="number"
                label={t("admin.form.availableSeats", { defaultValue: 'Available Seats' })}
                placeholder="e.g. 180"
                value={form.available_seats}
                onChange={handleChange}
                error={validationErrors?.available_seats?.[0] || localErrors.available_seats}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button
              type="button"
              onClick={() => navigate('/admin/flights')}
              className="btn-cancel"
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.05)', color: '#1a1c1d', fontWeight: 700, fontSize: 14, padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
            >
              <X size={16} /> {t("admin.form.cancel", { defaultValue: 'Cancel' })}
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="btn-submit"
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ffd700', color: '#1a1c1d', fontWeight: 700, fontSize: 14, padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,215,0,0.25)', transition: 'background 0.2s', opacity: actionLoading ? 0.7 : 1 }}
            >
              <Save size={16} /> {actionLoading ? t("admin.form.saving", { defaultValue: 'Saving...' }) : t("admin.form.saveFlight", { defaultValue: 'Save Flight Route' })}
            </button>
          </div>

        </form>
      </div>
    </>
  );
}
