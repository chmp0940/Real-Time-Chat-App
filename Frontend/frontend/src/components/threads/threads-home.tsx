'use client'

import Link from "next/link";

function ThreadHomePage()
{

  return <div>
    <Link href="/threads/new">Add new Thread</Link>
  </div>
}

export default ThreadHomePage;