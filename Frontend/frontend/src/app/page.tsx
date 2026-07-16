import { Suspense } from "react";
import ThreadHomePage from "@/components/threads/threads-home";


export default function ThreadsPage()
{
  return <div className="flex w-full flex-1 flex-col">
    <Suspense fallback={<div className="flex items-center justify-center flex-1">Loading...</div>}>
      <ThreadHomePage/>
    </Suspense>
  </div>
}