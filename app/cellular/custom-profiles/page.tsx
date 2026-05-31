import { Suspense } from "react";
import CustomProfileComponent from "@/components/cellular/custom-profiles/custom-profile";

const CustomProfilePage = () => {
  return (
    <Suspense fallback={null}>
      <CustomProfileComponent />
    </Suspense>
  );
};

export default CustomProfilePage;
