"use client";

import {useEffect, useState} from "react";
import SignUpForm from "../signup/ui/SignUpForm";
import {useRouter} from "next/navigation";

export default function SignUp() {
  const router = useRouter();
  const [created, setCreated] = useState(false);
  const handleFormSubmit = (success: boolean) => {
    setCreated(success);
  };

  useEffect(() => {
    if (created) {
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    }
  }, [created]);

  return (
    <div>
      <SignUpForm onFormSubmit={handleFormSubmit}/>
      {created && <p className="success">User created!</p>}
    </div>
  );
}
