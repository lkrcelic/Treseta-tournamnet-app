// Client-side checks for the signup form, with Croatian messages. The API validates again with the same limits
// (PlayerCreate in _interfaces/player.ts).

export type SignupValues = {
  username: string;
  password: string;
  confirm: string;
  email: string;
  first_name: string;
  last_name: string;
  birth_date: string;
};

export type SignupErrors = Partial<Record<keyof SignupValues, string>>;

export function validateSignupField(field: keyof SignupValues, v: SignupValues): string | undefined {
  const value = (v[field] ?? "").trim();
  switch (field) {
    case "username":
      if (!value) return "Obavezno polje.";
      if (value.length < 3) return "Najmanje 3 znaka.";
      return undefined;
    case "password":
      if (!v.password) return "Obavezno polje.";
      if (v.password.length < 5) return "Najmanje 5 znakova.";
      return undefined;
    case "confirm":
      if (!v.confirm) return "Obavezno polje.";
      if (v.confirm !== v.password) return "Lozinke se ne podudaraju.";
      return undefined;
    case "email":
      if (!value) return "Obavezno polje.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Neispravan email.";
      return undefined;
    case "first_name":
    case "last_name":
      if (!value) return "Obavezno polje.";
      if (value.length < 3) return "Najmanje 3 znaka.";
      return undefined;
    case "birth_date":
      if (!value) return "Obavezno polje.";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Neispravan datum.";
      return undefined;
  }
}

export function validateSignup(v: SignupValues): SignupErrors {
  const errors: SignupErrors = {};
  (Object.keys(v) as (keyof SignupValues)[]).forEach((k) => {
    const e = validateSignupField(k, v);
    if (e) errors[k] = e;
  });
  return errors;
}
