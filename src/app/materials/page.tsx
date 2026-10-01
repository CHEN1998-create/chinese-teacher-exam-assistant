"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MaterialCard } from "@/components/ui/MaterialCard";
import { ResourceCard } from "@/components/ui/ResourceCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingPage } from "@/components/ui/Loading";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { materialService, resourceService, examTargetService } from "@/lib/services";

const tabs = [
  { id: "materials", label: "我的资料" },
  { id: "resources", label: "替代资源" },
  { id: "missing", label: "缺少模块" },
];

export default function MaterialsPage() {
  const [activeTab, setActiveTab] = useState("materials");
  const [isLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    name: "",
    author: "",
    year: new Date().getFullYear(),
  });

  const currentExam = examTargetService.getCurrent();

  const materials = useMemo(() => {
    if (!currentExam) return [];
    return materialService.getByExamTargetId(currentExam.id);
  }, [currentExam]);

  const missingModules = useMemo(() => {
    const modules = new Set<string>();
    materials.forEach((m) => {
      m.diagnosis?.missingModules.forEach((mod) => modules.add(mod));
    });
    return Array.from(modules);
  }, [materials]);

  const recommendedResources = useMemo(() => {
    return resourceService.getRecommended(3);
  }, []);

  if (isLoading) return <LoadingPage />;

  const handleAddMaterial = () => {
    if (!newMaterial.name || !currentExam) return;
    materialService.create({
      examTargetId: currentExam.id,
      name: newMaterial.name,
      author: newMaterial.author,
      year: newMaterial.year,
      chapters: [],
      progress: 0,
      status: "in_use",
    });
    setIsAddModalOpen(false);
    setNewMaterial({ name: "", author: "", year: new Date().getFullYear() });
  };

  const handleAddResourceToPlan = (resourceId: string) => {
    // TODO: 实现资源加入计划
    console.log("Add resource to plan:", resourceId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">资料与资源</h2>
          <p className="text-sm text-slate-500 mt-1">
            管理你的备考资料，发现缺少的学习模块
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>新增资料</Button>
      </div>

      {/* 缺少模块提示 */}
      {missingModules.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-amber-800">发现资料缺口</h3>
              <p className="text-sm text-amber-700 mt-1">
                你当前缺少以下模块的资料：
                {missingModules.map((mod) => (
                  <span key={mod} className="font-medium">
                    {mod}、
                  </span>
                ))}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab}>
        <TabPanel id="materials" activeTab={activeTab}>
          {materials.length > 0 ? (
            <div className="space-y-4">
              {materials.map((material) => (
                <MaterialCard key={material.id} material={material} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="还没有添加资料"
              description="添加你的备考资料，系统会帮你诊断资料是否适用"
              actionLabel="添加资料"
              onAction={() => setIsAddModalOpen(true)}
            />
          )}
        </TabPanel>

        <TabPanel id="resources" activeTab={activeTab}>
          {recommendedResources.length > 0 ? (
            <div className="space-y-4">
              {recommendedResources.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onAddToPlan={handleAddResourceToPlan}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="暂无已核验资源"
              description="我们会尽快审核更多合规资源，稍后再来看"
            />
          )}
        </TabPanel>

        <TabPanel id="missing" activeTab={activeTab}>
          {missingModules.length > 0 ? (
            <div className="space-y-4">
              {missingModules.map((module) => (
                <Card key={module}>
                  <h4 className="font-medium text-slate-900 mb-2">{module}</h4>
                  <p className="text-sm text-slate-600 mb-3">
                    你当前没有覆盖该模块的资料，建议寻找以下类型的资源：
                  </p>
                  <div className="space-y-2">
                    {resourceService.getByModule(module).slice(0, 2).map((resource) => (
                      <div
                        key={resource.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">{resource.title}</p>
                          <p className="text-xs text-slate-500">{resource.source}</p>
                        </div>
                        <Button size="sm" variant="outline">
                          查看
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="没有发现缺少的模块"
              description="你的资料覆盖了所有必要的学习模块"
            />
          )}
        </TabPanel>
      </Tabs>

      {/* 新增资料弹窗 */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="新增资料"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddMaterial} disabled={!newMaterial.name}>
              添加
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="资料名称"
            placeholder="例如：《语文考编通关宝典》"
            value={newMaterial.name}
            onChange={(e) => setNewMaterial((p) => ({ ...p, name: e.target.value }))}
          />
          <Input
            label="作者"
            placeholder="资料作者或主编"
            value={newMaterial.author}
            onChange={(e) => setNewMaterial((p) => ({ ...p, author: e.target.value }))}
          />
          <Input
            label="出版年份"
            type="number"
            value={newMaterial.year}
            onChange={(e) =>
              setNewMaterial((p) => ({ ...p, year: parseInt(e.target.value) || 2026 }))
            }
          />
        </div>
      </Modal>
    </div>
  );
}
