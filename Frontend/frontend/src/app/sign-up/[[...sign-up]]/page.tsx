import {  SignUp } from "@clerk/nextjs";
import Link from "next/link";
import path from 'node:path';



export default function SignUpPage()
{
  return <main className="flex min-h-[calc(100vh-4em)] items-center justify-center px-4">
    <div className="w-full max-w-md space-y-8">
    <div className="space-y-2 text-center">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Create an Account</h1>
    </div>
    <div className="rounded-2xl border border-border/70 bg-card p-6 backdrop-blur-sm">
    <SignUp
    routing="path"
    path="/sign-up"
    signInUrl="/sign-in"
    fallbackRedirectUrl='/'
    />
    </div>
    <p className="text-center text-xs text-muted-foreground ">Already Have an Account ?  
      <Link className="font-medium text-primary underline-offset-4 hover:text-primary/90" href={'/sign-in'}>Sign in</Link>
    </p>
    </div>
  </main>
}