"use client";

import { useRouter } from "next/navigation";
import CreatePostModal, { type PublishPostResult } from "@/app/components/CreatePostModal";

export default function CreatePostPage() {
  const router = useRouter();

  const handleClose = () => {
    router.back();
  };

  const handlePublished = (result?: PublishPostResult) => {
    if (result?.helpRequestId) {
      router.push(
        `/dashboard?focus=${encodeURIComponent(result.helpRequestId)}&source=create_post`,
      );
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <CreatePostModal
      open={true}
      onClose={handleClose}
      onPublished={handlePublished}
      variant="page"
    />
  );
}
