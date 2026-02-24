"use client";

export default function ProfilePage() {
  const user = {
    name: "Mothy",
    email: "mothy@gmail.com",
    role: "Core Architect",
    status: "Elite Status",
    verified: true,
  };

  const initial = user.name?.charAt(0)?.toUpperCase() || "U";

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-lg p-10">
      
      <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
        
        {/* Avatar */}
        <div className="bg-[#4285F4] rounded-full w-24 h-24 flex items-center justify-center text-white text-4xl font-bold shadow-md">
          {initial}
        </div>

        {/* User Info */}
        <div className="text-center md:text-left">
          <h2 className="text-3xl font-bold text-gray-900">
            {user.name}
          </h2>

          <p className="text-gray-500">{user.email}</p>

          <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
            {user.verified && (
              <span className="bg-[#34A853] text-white px-3 py-1 rounded-full text-xs font-semibold">
                Verified
              </span>
            )}

            <span className="bg-[#4285F4] text-white px-3 py-1 rounded-full text-xs font-semibold">
              {user.role}
            </span>

            <span className="bg-[#AECBFA] text-[#4285F4] px-3 py-1 rounded-full text-xs font-semibold">
              {user.status}
            </span>
          </div>
        </div>

        {/* Button */}
        <button className="md:ml-auto bg-[#4285F4] text-white px-6 py-2 rounded-xl font-semibold shadow hover:bg-[#357ae8] transition">
          Edit Identity
        </button>
      </div>

      <div className="border-t pt-6 text-gray-600 text-sm">
        <p>
          Add more profile details here like bio, skills, career goals,
          privacy settings, etc.
        </p>
      </div>

    </div>
  );
}