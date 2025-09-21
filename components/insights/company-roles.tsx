"use client";

import { memo } from "react";

interface CompanyRole {
  role: string;
  count: number;
  percentage: number;
}

interface RoleCategory {
  count: number;
  percentage: number;
}

interface CompanyRolesData {
  roles: CompanyRole[];
  categories: {
    leadership: RoleCategory;
    technical: RoleCategory;
    business: RoleCategory;
  };
  totalValidRoles: number;
  totalResponses: number;
}

interface CompanyRolesProps {
  data: CompanyRolesData;
  loading?: boolean;
}

const CompanyRoles = memo(({ data, loading }: CompanyRolesProps) => {
  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-6 bg-white/10 rounded w-48 animate-pulse"></div>
            <div className="h-4 bg-white/10 rounded w-32 mt-2 animate-pulse"></div>
          </div>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 bg-white/10 rounded w-20 animate-pulse" />
              <div className="h-4 bg-white/10 rounded w-12 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.roles.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-white">
              Professional Roles
            </h3>
            <p className="text-white/60 text-sm">Job titles and positions</p>
          </div>
        </div>
        <p className="text-white/60 text-center py-8">No role data available</p>
      </div>
    );
  }

  const { roles, categories, totalValidRoles, totalResponses } = data;

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white">
            Professional Roles
          </h3>
          <p className="text-white/60 text-sm">
            {totalValidRoles} valid roles from {totalResponses} responses
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Role Categories Overview */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="text-2xl font-bold text-blue-400">
              {categories.leadership.count}
            </div>
            <div className="text-xs text-white/60">Leadership</div>
            <div className="text-xs text-blue-400">
              {categories.leadership.percentage}%
            </div>
          </div>
          <div className="text-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <div className="text-2xl font-bold text-green-400">
              {categories.technical.count}
            </div>
            <div className="text-xs text-white/60">Technical</div>
            <div className="text-xs text-green-400">
              {categories.technical.percentage}%
            </div>
          </div>
          <div className="text-center p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <div className="text-2xl font-bold text-purple-400">
              {categories.business.count}
            </div>
            <div className="text-xs text-white/60">Business</div>
            <div className="text-xs text-purple-400">
              {categories.business.percentage}%
            </div>
          </div>
        </div>

        {/* Top Roles List */}
        <div className="space-y-3">
          <h4 className="font-medium text-white">Top Professional Roles</h4>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {roles.map((role, index) => (
              <div
                key={role.role}
                className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-white/60 w-6">
                    {index + 1}.
                  </span>
                  <span className="text-sm font-medium text-white">
                    {role.role}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-semibold text-white">
                    {role.count}
                  </span>
                  <span className="text-xs text-white/60 w-12 text-right">
                    ({role.percentage}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Response Rate Info */}
        <div className="pt-3 border-t border-white/10">
          <div className="text-xs text-white/50">
            Response rate:{" "}
            {Math.round((totalValidRoles / totalResponses) * 100)}% (
            {totalValidRoles} of {totalResponses} provided valid role
            information)
          </div>
        </div>
      </div>
    </div>
  );
});

CompanyRoles.displayName = "CompanyRoles";

export { CompanyRoles };
export type { CompanyRolesData, CompanyRolesProps };
