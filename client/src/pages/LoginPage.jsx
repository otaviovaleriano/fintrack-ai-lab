import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import logo from "../assets/FinTrack-logo.png";
import { supabase } from "../supabaseClient";
import { useNavigate } from 'react-router-dom';


const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLogin, setIsLogin] = useState(true);

  const [formErrors, setFormErrors] = useState({});
  const [infoMessage, setInfoMessage] = useState("");

    const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validateLogin = () => {
    const errors = {};
    if (!formData.email) errors.email = "Email is required";
    if (!formData.password) errors.password = "Password is required";
    return errors;
  };

  const validateSignup = () => {
    const errors = validateLogin();
    if (!formData.confirmPassword)
      errors.confirmPassword = "Confirm your password";
    if (formData.password !== formData.confirmPassword)
      errors.confirmPassword = "Passwords do not match";
    return errors;
  };

  const handleLogin = async () => {
    const errors = validateLogin();
    if (Object.keys(errors).length > 0) return setFormErrors(errors);
    setFormErrors({});
    setInfoMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    });

    if (error) {
      setFormErrors({ general: error.message });
      return;
    }

    // UserContext's onAuthStateChange listener picks up the new session
    // on its own - no manual context update needed here.
    navigate('/');
  };

  const handleSignup = async () => {
    const errors = validateSignup();
    if (Object.keys(errors).length > 0) return setFormErrors(errors);
    setFormErrors({});
    setInfoMessage("");

    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        // Preserves the app's existing behavior (name derived from the
        // email prefix) - this metadata is what the Phase 2 signup
        // trigger reads via coalesce() to create the matching profiles
        // row.
        data: { name: formData.email.split("@")[0] },
      },
    });

    if (error) {
      setFormErrors({ general: error.message });
      return;
    }

    if (data.session) {
      // Email confirmation is off for this project - signUp returned an
      // active session immediately, same as the old flow.
      navigate('/');
    } else {
      // Email confirmation is on - there is a pending user but no
      // session yet. Not an error, so it isn't rendered as one.
      setInfoMessage("Account created! Check your email to confirm it before logging in.");
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card
        className="w-full max-w-md shadow-xl"
        style={{ backgroundColor: "#F9F8F7" }}
      >
        <CardHeader className="text-center">
          <img src={logo} alt="FinTrack Logo" className="w-40 mx-auto mb-4" />
          <CardTitle className="text-2xl mt-4 text-blue-500">
            Welcome to FinTrack
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mt-4">
            <h2 className="text-xl font-semibold text-center">
              {isLogin ? "Log In" : "Create Account"}
            </h2>

            <Input
              name="email"
              placeholder="Email"
              type="email"
              value={formData.email}
              onChange={handleChange}
            />
            {formErrors.email && (
              <p className="text-red-500 text-sm">{formErrors.email}</p>
            )}

            <Input
              name="password"
              placeholder="Password"
              type="password"
              value={formData.password}
              onChange={handleChange}
            />
            {formErrors.password && (
              <p className="text-red-500 text-sm">{formErrors.password}</p>
            )}

            {!isLogin && (
              <>
                <Input
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                {formErrors.confirmPassword && (
                  <p className="text-red-500 text-sm">
                    {formErrors.confirmPassword}
                  </p>
                )}
              </>
            )}

            {formErrors.general && (
              <p className="text-red-500 text-sm text-center">
                {formErrors.general}
              </p>
            )}

            {infoMessage && (
              <p className="text-green-600 text-sm text-center">
                {infoMessage}
              </p>
            )}

            <Button
              className="w-full"
              onClick={isLogin ? handleLogin : handleSignup}
            >
              {isLogin ? "Log In" : "Create Account"}
            </Button>

            <p className="text-center text-sm text-gray-600">
              {isLogin ? (
                <>
                  Don’t have an account?{" "}
                  <span
                    onClick={() => {
                      setFormErrors({});
                      setInfoMessage("");
                      setIsLogin(false);
                    }}
                    className="text-blue-600 hover:underline cursor-pointer"
                  >
                    Sign up here
                  </span>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <span
                    onClick={() => {
                      setFormErrors({});
                      setInfoMessage("");
                      setIsLogin(true);
                    }}
                    className="text-blue-600 hover:underline cursor-pointer"
                  >
                    Log in here
                  </span>
                </>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
