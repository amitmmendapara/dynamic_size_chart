import SizeChartSection from "./components/SizeChartSection.jsx";

// The product this size chart belongs to. In a real product editor this
// would come from the route (e.g. /products/:productId/size-chart).
const PRODUCT_ID = "22222222-2222-2222-2222-222222222222";

export default function App() {
  return <SizeChartSection productId={PRODUCT_ID} />;
}
