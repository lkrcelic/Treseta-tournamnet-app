"use client";

import {useState} from "react";
import {PlayerCreate} from "@/app/_interfaces/player";
import {LoginUser, LoginUserInterface} from "@/app/_interfaces/login";
import {loginUser} from "@/app/_fetchers/authentication/login";
import {Box, TextField, Button, InputAdornment, IconButton} from "@mui/material";
import {Visibility, VisibilityOff} from "@mui/icons-material";

type FormField = keyof typeof LoginUser.shape;
type ErrorState = Partial<Record<FormField, string>>;

interface LogInFormProperties {
  onFormSubmit?: (success: boolean) => void;
}

export default function LogInForm({onFormSubmit}: LogInFormProperties) {
  const initialState = {
    username: "",
    password: "",
  } as LoginUserInterface;
  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState<ErrorState>({});
  const [showPassword, setShowPassword] = useState(false);

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const {name, value} = e.target;
    setFormData({...formData, [name]: value});

    const fieldName = name as FormField;
    try {
      PlayerCreate.pick({[fieldName]: true} as Record<FormField, true>).parse({[name]: value});
      setErrors((prevErrors) => ({...prevErrors, [fieldName]: undefined}));
    } catch (error) {
      if (error.errors && error.errors[0]) {
        setErrors((prevErrors) => ({
          ...prevErrors,
          [fieldName]: error.errors[0].message,
        }));
      }
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const isAllFieldsFilled = Object.values(formData).every((value) => (value as string).trim() !== "");
      if (!isAllFieldsFilled) throw new Error("Required properties are empty.");
    } catch (error) {
      const keys = Object.keys(formData) as FormField[];
      keys.forEach((key) => {
        if ((formData[key] as string).trim() === "") {
          errors[key] = key + " je obavezno polje!";
        }
      });
      setErrors((prevErrors) => ({
        ...prevErrors,
      }));
      return;
    }
    try {
      const parsedData = LoginUser.parse(formData);
      const success = await loginUser(parsedData);
      if (onFormSubmit) onFormSubmit(success);
      if (success) setFormData({...initialState});
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <TextField
        required
        fullWidth
        id="username"
        label="Korisničko ime ili Email"
        name="username"
        autoComplete="username"
        autoFocus
        value={formData.username}
        onChange={handleChange}
        error={!!errors.username}
        helperText={errors.username}
        variant="outlined"
        size="medium"
        sx={{ 
          mb: 2.5,
          '& .MuiOutlinedInput-root': {
            borderRadius: 1.5,
            '&.Mui-focused fieldset': {
              borderWidth: 2
            }
          }
        }}
      />
      
      <TextField
        required
        fullWidth
        name="password"
        label="Lozinka"
        type={showPassword ? 'text' : 'password'}
        id="password"
        autoComplete="current-password"
        value={formData.password}
        onChange={handleChange}
        error={!!errors.password}
        helperText={errors.password}
        variant="outlined"
        size="medium"
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label="toggle password visibility"
                onClick={handleClickShowPassword}
                edge="end"
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{ 
          mb: 3,
          '& .MuiOutlinedInput-root': {
            borderRadius: 1.5,
            '&.Mui-focused fieldset': {
              borderWidth: 2
            }
          }
        }}
      />
      
      <Button
        type="submit"
        fullWidth
        variant="contained"
        color="primary"
        size="large"
        sx={{ 
          py: 1.5,
          borderRadius: 1.5,
          textTransform: 'none',
          fontSize: '1rem',
          fontWeight: 'bold',
          boxShadow: 2
        }}
      >
        Prijavi se
      </Button>
    </Box>
  );
}
