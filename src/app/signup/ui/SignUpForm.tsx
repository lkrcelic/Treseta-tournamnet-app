"use client";

import {useState} from "react";
import styles from "@/app/_styles/Form.modules.css";
import {PlayerCreate, PlayerCreateInterface} from "@/app/_interfaces/player";
import {signUp} from "@/app/_fetchers/authentication/signup";

type FormField = keyof typeof PlayerCreate.shape;
type ErrorState = Partial<Record<FormField, string>>;

type SignUpFormProperties = {
  onFormSubmit?: (success: boolean) => void;
}

export default function SignUpForm({onFormSubmit}: SignUpFormProperties) {
  const initialState = {
    username: "",
    password: "",
    email: "",
    first_name: "",
    last_name: "",
    birth_date: "",
  } as PlayerCreateInterface;
  const [formData, setFormData] = useState(initialState);

  const initialConfirm = {
    password: "",
    matching: true,
  };
  const [confirm, setConfirmPassword] = useState(initialConfirm);

  const [errors, setErrors] = useState<ErrorState>({});

  const handlePasswordChange = (e: unknown) => {
    const {name, value} = e.target;

    if (name == "confirm_password") {
      confirm.password = value;
    } else if (name == "password") {
      formData.password = value;
      handleChange(e);
    }

    if (confirm.password != formData.password && confirm.password.trim() != "") confirm.matching = false;
    else confirm.matching = true;

    setFormData({...formData});
    setConfirmPassword({...confirm});
  };

  const handleChange = (e: unknown) => {
    const {name, value} = e.target;
    setFormData({...formData, [name]: value});
    const fieldName = name as FormField;
    try {
      PlayerCreate.pick({[fieldName]: true} as Record<FormField, true>).parse({[name]: value});
      setErrors((prevErrors) => ({...prevErrors, [fieldName]: undefined}));
    } catch (error: unknown) {
      if (error.errors && error.errors[0]) {
        setErrors((prevErrors) => ({
          ...prevErrors,
          [fieldName]: error.errors[0].message,
        }));
      }
    }
  };

  function checkAllFieldsPopulated(): boolean {
    try {
      const isAllFieldsFilled = Object.values(formData).every((value) => (value as string).trim() !== "");
      if (!isAllFieldsFilled) throw new Error("Required properties are empty.");
      return true;
    } catch (error) {
      const keys = Object.keys(formData) as FormField[];
      keys.forEach((key) => {
        if ((formData[key] as string).trim() === "") {
          errors[key] = "Required";
        }
      });
      setErrors((prevErrors) => ({
        ...prevErrors,
      }));
      return false;
    }
  }

  function handleResponseErrors(errors: Record<string, string> | undefined): void {
    if (!errors) return;

    const validFields = Object.keys(PlayerCreate.shape);
    const filteredErrors = Object.keys(errors)
      .filter((key) => validFields.includes(key))
      .reduce((obj, key) => {
        obj[key as FormField] = errors[key];
        return obj;
      }, {} as ErrorState);
    setErrors((prevErrors) => ({
      ...prevErrors,
      ...filteredErrors,
    }));
  }

  async function handleSubmit(e: unknown) {
    e.preventDefault();
    if (!checkAllFieldsPopulated()) return;

    // check if password and confirm password match
    if (formData.password != confirm.password) {
      setConfirmPassword({...confirm, matching: false});
      return;
    }

    try {
      const parsedData = PlayerCreate.parse(formData);
      const res = await signUp(parsedData);
      if (onFormSubmit) onFormSubmit(res.success);
      if (res.success) {
        setFormData({...initialState});
        setConfirmPassword({...initialConfirm});
      } else {
        handleResponseErrors(res.errors);
      }
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <label htmlFor="username">Username</label>
      <input type="text" id="username" name="username" value={formData.username} onChange={handleChange}/>
      {errors.username && <p className="error">{errors.username}</p>}
      <label htmlFor="password" className={styles.label}>
        Password
      </label>
      <input type="password" id="password" name="password" value={formData.password} onChange={handlePasswordChange}/>
      {errors.password && <p className="error">{errors.password}</p>}
      <label htmlFor="confirm_password" className={styles.label}>
        Confirm password
      </label>
      <input
        type="password"
        id="confirm_password"
        name="confirm_password"
        value={confirm.password}
        onChange={handlePasswordChange}
      />
      {!confirm.matching && <p className="error">Passwords don&#39;t match.</p>}
      <label htmlFor="email" className={styles.label}>
        Email
      </label>
      <input type="text" id="email" name="email" value={formData.email} onChange={handleChange}/>
      {errors.email && <p className="error">{errors.email}</p>}
      <label htmlFor="name" className={styles.label}>
        Name
      </label>
      <input type="text" id="name" name="first_name" value={formData.first_name} onChange={handleChange}/>
      {errors.first_name && <p className="error">{errors.first_name}</p>}
      <label htmlFor="lastname" className={styles.label}>
        Lastname
      </label>
      <input type="text" id="lastname" name="last_name" value={formData.last_name} onChange={handleChange}/>
      {errors.last_name && <p className="error">{errors.last_name}</p>}
      <label htmlFor="birth_date" className={styles.label}>Date of Birth</label>
      <input
        type="date"
        id="birth_date"
        name="birth_date"
        value={formData.birth_date}
        onChange={handleChange}
      />
      {errors.birth_date && <p className="error">{errors.birth_date}</p>}

      <button type="submit" className={styles.button}>
        Submit
      </button>
    </form>
  );
}
