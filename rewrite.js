const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/admin/operations/FlightOverviewPage.jsx', 'utf-8');

// Replace component name
code = code.replace(/AdminFlightsList/g, 'FlightOverviewPage');

// Remove add and delete actions from UI
code = code.replace(/<button className="add-btn".*?<\/button>/s, '');
code = code.replace(/<DeleteFlightDialog[\s\S]*?\/>/g, '');
code = code.replace(/<Modal isOpen=\{open\}[\s\S]*?<\/Modal>/g, '');

// Replace store imports
code = code.replace(/import \{[\s\S]*?\} from '@\/store\/flightSlice';/, `import { fetchFlightInstances, updateFlightInstance } from '@/store/adminSlices';`);

// Replace Redux hook
code = code.replace(/const \{ list: flights, count, currentPage, totalPages, loading, statsLoading, actionLoading, error, stats = \{\} \} = useSelector\(s => s\.flights\);/, `const { items: flights, count, loading, actionLoading, error } = useSelector(s => s.flightInstance);\n    const currentPage = 1;\n    const totalPages = Math.ceil(count / 10);\n    const statsLoading = false;\n    const stats = { total: 0, scheduled: 0, delayed: 0, cancelled: 0 };`);

// Replace fetch calls
code = code.replace(/fetchFlights/g, 'fetchFlightInstances');
code = code.replace(/fetchFlightStats/g, 'fetchFlightInstances'); // Dummy replace for stats
code = code.replace(/deleteFlight/g, 'updateFlightInstance'); // Dummy replace for delete
code = code.replace(/clearFlightErrors/g, 'fetchFlightInstances'); // Dummy

// Status editing
code = code.replace(/<Link to={`\/admin\/flights\/\$\{f\.id\}\/edit`}[\s\S]*?<\/Link>/g, `<button className="act" onClick={() => setEditTarget(f)} title="Edit Status" style={{ padding: 8, borderRadius: 8, color: '#5e5e5e', display: 'flex', alignItems: 'center', transition: 'background 0.2s' }}><Edit2 size={16} /></button>`);

// Fix actions row
code = code.replace(/<button className="act" onClick=\{.*?\bTrash2\b.*?<\/button>/, '');

fs.writeFileSync('frontend/src/pages/admin/operations/FlightOverviewPage.jsx', code);
