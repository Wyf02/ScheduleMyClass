import React, { useState, useEffect, useRef } from 'react';

// --- 1. 类型定义 (增加 startHour 和 endHour) ---

interface Course {
  id: string;
  name: string;
  day: number;          // 1-7
  startHour: number;    // 8.0 - 22.0
  endHour: number;
  credit: number;
  serialNumber: string;
  notes: string;
  isVisible: boolean;
}

interface Semester {
  id: string;
  name: string;
  courses: Course[];
  startHour: number; // ✅ 新增：该学期视图的开始时间
  endHour: number;   // ✅ 新增：该学期视图的结束时间
}

// 辅助函数
const generateId = () => Math.random().toString(36).substr(2, 9);
const formatTime = (decimalTime: number) => {
  const hrs = Math.floor(decimalTime);
  const mins = Math.round((decimalTime - hrs) * 60);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};
const timeStrToDecimal = (timeStr: string) => {
  if (!timeStr) return 0;
  const [hrs, mins] = timeStr.split(':').map(Number);
  return hrs + mins / 60;
};

// --- 布局算法：处理课程重叠 ---
const getDailyLayout = (courses: Course[]) => {
  const sorted = [...courses].sort((a, b) => a.startHour - b.startHour);
  const clusters: Course[][] = [];
  let currentCluster: Course[] = [];
  let clusterEnd = 0;

  sorted.forEach(course => {
    if (currentCluster.length === 0 || course.startHour < clusterEnd) {
      currentCluster.push(course);
      clusterEnd = Math.max(clusterEnd, course.endHour); 
    } else {
      clusters.push(currentCluster);
      currentCluster = [course];
      clusterEnd = course.endHour;
    }
  });
  if (currentCluster.length > 0) clusters.push(currentCluster);

  const layout: { [key: string]: React.CSSProperties } = {};
  
  clusters.forEach(cluster => {
    const columns: number[] = []; 
    cluster.forEach(course => {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        if (columns[i] <= course.startHour) {
          columns[i] = course.endHour; 
          layout[course.id] = {
            left: `${(i / columns.length) * 100}%`,
            width: `0%`, 
            column: i 
          } as any; 
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push(course.endHour);
        layout[course.id] = { left: `0%`, width: `0%`, column: columns.length - 1 } as any;
      }
    });
    const totalCols = columns.length;
    cluster.forEach(course => {
      const style = layout[course.id] as any;
      layout[course.id] = {
        left: `${(style.column / totalCols) * 100}%`,
        width: `${100 / totalCols}%`,
        zIndex: style.column + 10 // 基础层级设高一点
      };
    });
  });

  return layout;
};

export default function CourseScheduler() {
  // --- 状态管理 ---
  
  const [semesters, setSemesters] = useState<Semester[]>(() => {
    const saved = localStorage.getItem('my_course_data_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      // ✅ 兼容性处理：如果旧数据没有 startHour/endHour，给个默认值
      return parsed.map((s: any) => ({
        ...s,
        startHour: s.startHour || 8,
        endHour: s.endHour || 22
      }));
    }
    // 初始化默认学期
    return [{ id: generateId(), name: '2025 第一学期', courses: [], startHour: 8, endHour: 22 }];
  });

  const [activeSemesterId, setActiveSemesterId] = useState<string>(() => {
    const saved = localStorage.getItem('my_course_data_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.length > 0 ? parsed[0].id : '';
    }
    return '';
  });

  useEffect(() => {
    if (!activeSemesterId && semesters.length > 0) {
      setActiveSemesterId(semesters[0].id);
    }
  }, [semesters, activeSemesterId]);

  useEffect(() => {
    localStorage.setItem('my_course_data_v2', JSON.stringify(semesters));
  }, [semesters]);

  // --- 衍生变量 ---
  const activeSemester = semesters.find(s => s.id === activeSemesterId);
  const currentCourses = activeSemester?.courses || [];

  // ✅ 动态获取当前学期的时间设置 (如果没有则兜底 8-22)
  const currentStartHour = activeSemester?.startHour ?? 8;
  const currentEndHour = activeSemester?.endHour ?? 22;
  const totalHours = currentEndHour - currentStartHour;

  // --- 学期管理逻辑 ---

  const addSemester = () => {
    const name = prompt("请输入新学期名称:", "新学期");
    if (!name) return;
    // ✅ 新建学期默认 8:00 - 22:00
    const newSem: Semester = { id: generateId(), name, courses: [], startHour: 8, endHour: 22 };
    setSemesters([...semesters, newSem]);
    setActiveSemesterId(newSem.id);
  };

  const deleteSemester = () => {
    if (semesters.length <= 1) return alert("至少保留一个学期！");
    if (confirm(`确定删除 "${activeSemester?.name}" 吗？`)) {
      const remaining = semesters.filter(s => s.id !== activeSemesterId);
      setSemesters(remaining);
      setActiveSemesterId(remaining[0].id);
    }
  };

  const renameSemester = () => {
    const newName = prompt("重命名当前学期:", activeSemester?.name);
    if (newName) updateSemesterConfig('name', newName);
  };

  // ✅ 通用学期配置更新函数 (改名、改时间)
  const updateSemesterConfig = (key: keyof Semester, value: any) => {
    setSemesters(semesters.map(s => 
      s.id === activeSemesterId ? { ...s, [key]: value } : s
    ));
  };

  // --- 导入导出 ---
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(semesters, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `课表备份_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (Array.isArray(json) && json[0]?.courses) {
          // 导入时也要做兼容性处理
          const compatible = json.map((s: any) => ({
             ...s,
             startHour: s.startHour || 8,
             endHour: s.endHour || 22
          }));
          setSemesters(compatible);
          setActiveSemesterId(compatible[0].id);
          alert("导入成功！");
        }
      } catch (err) { alert("文件无效"); }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // --- 课程 CRUD ---
  const updateCurrentCourses = (newCourses: Course[]) => {
    setSemesters(semesters.map(s => s.id === activeSemesterId ? { ...s, courses: newCourses } : s));
  };

  const addCourse = () => {
    const newCourse: Course = {
      id: generateId(),
      name: "新课程",
      day: 1,
      startHour: currentStartHour, // 默认从当前视图开始时间起
      endHour: currentStartHour + 1.5,
      credit: 2,
      serialNumber: "",
      notes: "",
      isVisible: true
    };
    updateCurrentCourses([...currentCourses, newCourse]);
  };

  const updateCourse = (id: string, field: keyof Course, value: any) => {
    const updated = currentCourses.map(c => c.id === id ? { ...c, [field]: value } : c);
    updateCurrentCourses(updated);
  };

  const deleteCourse = (id: string) => {
    if (confirm("删除这门课？")) updateCurrentCourses(currentCourses.filter(c => c.id !== id));
  };

  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  return (
    <div className="h-screen flex flex-col bg-gray-50 text-sm font-sans">
      
      {/* 顶部控制栏 */}
      {/* 顶部控制栏 */}
      <div className="bg-white border-b shadow-sm z-20 flex-shrink-0"> {/* flex-shrink-0 防止被挤压 */}
        
        {/* 第一行：标题 + 备份按钮 */}
        <div className="p-3 flex flex-col md:flex-row justify-between items-center gap-3 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            📅 本地课表
            {/* 手机上隐藏这个长标签，省空间 */}
            <span className="hidden md:inline text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded">隐私安全: 本地存储</span>
          </h1>
          <div className="flex gap-2 w-full md:w-auto justify-center">
            <button onClick={handleExport} className="flex-1 md:flex-none px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 whitespace-nowrap">
              📥 备份
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex-1 md:flex-none px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 whitespace-nowrap">
              📤 恢复
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
          </div>
        </div>

        {/* 第二行：学期操作 (改为自动换行 flex-wrap) */}
        <div className="p-3 flex flex-wrap items-center justify-between gap-3 bg-blue-50/50">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <label className="text-gray-600 font-medium whitespace-nowrap">学期：</label>
            <select 
              value={activeSemesterId} 
              onChange={(e) => setActiveSemesterId(e.target.value)}
              className="flex-1 md:flex-none border border-blue-200 rounded px-2 py-1 text-blue-900 font-bold bg-white outline-none min-w-[120px]"
            >
              {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            
            {/* 时间范围设置 (手机上稍微缩小点) */}
            <div className="flex items-center gap-1 text-gray-600 bg-white px-2 py-1 rounded border border-blue-100 ml-auto md:ml-2">
              <span className="text-xs text-gray-400">时间:</span>
              <input 
                type="number" 
                value={currentStartHour} 
                onChange={(e) => updateSemesterConfig('startHour', Number(e.target.value))}
                className="w-8 text-center border rounded bg-gray-50 text-xs py-0.5"
              />
              <span className="text-xs">-</span>
              <input 
                type="number" 
                value={currentEndHour} 
                onChange={(e) => updateSemesterConfig('endHour', Number(e.target.value))}
                className="w-8 text-center border rounded bg-gray-50 text-xs py-0.5"
              />
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
             {/* 这里的按钮加上 flex-1 让它们在手机上平分宽度 */}
            <button onClick={renameSemester} className="flex-1 md:flex-none text-center px-2 py-1 text-blue-600 border border-blue-200 rounded text-xs hover:bg-blue-50">重命名</button>
            <button onClick={addSemester} className="flex-1 md:flex-none justify-center px-3 py-1 bg-green-100 text-green-700 border border-green-200 rounded hover:bg-green-200 flex items-center gap-1 whitespace-nowrap">
              ✨ 新学期
            </button>
            <button onClick={addCourse} className="flex-1 md:flex-none justify-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm flex items-center gap-1 whitespace-nowrap">
              + 添加
            </button>
          </div>
        </div>
      </div>

      {/* 中间：周视图 */}
      <div className="flex-1 overflow-y-auto relative p-4 bg-white">
        <div className="grid grid-cols-8 gap-2 min-w-[800px]">
          {/* 时间轴 */}
          <div className="col-span-1 relative h-[600px] border-r">
             {Array.from({ length: totalHours + 1 }).map((_, i) => (
               <React.Fragment key={i}>
                 <div 
                    className="absolute border-t border-gray-200 w-[800%] z-[5] pointer-events-none"
                    style={{ top: `${(i / totalHours) * 100}%`, left: 0 }}
                 />
                 <div 
                    className="absolute w-full text-right pr-2 text-xs text-gray-400 -mt-2 z-[6]" 
                    style={{ top: `${(i / totalHours) * 100}%` }}
                 >
                   <span className="bg-white/80 px-1">{currentStartHour + i}:00</span>
                 </div>
               </React.Fragment>
             ))}
          </div>

          {/* 课程列 */}
          {days.map((dayName, dayIndex) => {
            const dayCourses = currentCourses.filter(c => c.day === dayIndex + 1 && c.isVisible);
            const layoutStyles = getDailyLayout(dayCourses);

            return (
              <div key={dayName} className="col-span-1 relative h-[600px] bg-gray-50/50 rounded border border-gray-100">
                <div className="text-center text-xs font-bold text-gray-500 py-2 border-b">{dayName}</div>
                {dayCourses.map(course => {
                  // ✅ 渲染位置根据当前的 currentStartHour 动态计算
                  const top = ((course.startHour - currentStartHour) / totalHours) * 100;
                  const height = ((course.endHour - course.startHour) / totalHours) * 100;
                  const overlapStyle = layoutStyles[course.id] || { left: '0%', width: '100%' };

                  return (
                    <div 
                      key={course.id}
                      className="absolute rounded p-1.5 text-xs bg-blue-100 text-blue-900 border-l-4 border-blue-500 overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform shadow-sm group"
                      style={{ 
                        top: `${top}%`, 
                        height: `${height}%`,
                        left: overlapStyle.left,
                        width: overlapStyle.width,
                        zIndex: 10
                      }}
                      title={`${course.name} (${formatTime(course.startHour)} - ${formatTime(course.endHour)})`}
                    >
                      <div className="font-bold leading-tight truncate">{course.name}</div>
                      <div className="opacity-80 scale-90 origin-left mt-1 truncate">
                        {formatTime(course.startHour)} - {formatTime(course.endHour)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部：课程编辑列表 */}
      <div className="h-[40%] bg-white border-t flex flex-col">
        <div className="p-2 bg-gray-50 border-b text-xs text-gray-500 flex justify-between items-center">
          <span className="font-bold">📝 课程管理列表</span>
          <span className="md:hidden text-gray-400">(表格可左右滑动编辑 →)</span>
        </div>
        
        {/* 关键修改：添加 overflow-x-auto 让表格可横向滚动 */}
        <div className="flex-1 overflow-auto w-full">
          <table className="w-full text-left text-xs min-w-[800px]"> {/* min-w-[800px] 强制表格不折叠 */}
            <thead className="bg-gray-100 text-gray-600 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-2 w-10 text-center">👁️</th>
                <th className="p-2 min-w-[120px]">课程名称</th> {/* 设定最小宽度防止挤压 */}
                <th className="p-2 w-20">周几</th>
                <th className="p-2 w-24">开始</th>
                <th className="p-2 w-24">结束</th>
                <th className="p-2 w-12">学分</th>
                <th className="p-2 min-w-[150px]">备注</th>
                <th className="p-2 w-10">删</th>
              </tr>
            </thead>
            <tbody>
              {currentCourses.map(course => (
                <tr key={course.id} className="border-b hover:bg-blue-50 transition-colors">
                  {/* ...这里面的 td 内容保持不变... */}
                  {/* 只是建议给 input 加上 min-w，比如: */}
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={course.isVisible} onChange={(e) => updateCourse(course.id, 'isVisible', e.target.checked)} className="w-4 h-4" />
                  </td>
                  <td className="p-2"><input value={course.name} onChange={e => updateCourse(course.id, 'name', e.target.value)} className="w-full border rounded px-1 py-1 min-w-[100px]" /></td>
                  <td className="p-2">
                    <select value={course.day} onChange={e => updateCourse(course.id, 'day', Number(e.target.value))} className="border rounded py-1 w-full">
                      {days.map((d, i) => <option key={i} value={i+1}>{d}</option>)}
                    </select>
                  </td>
                  {/* 时间选择器保持原样，它们在手机上会自动弹出滚轮选择 */}
                  <td className="p-2"><input type="time" value={formatTime(course.startHour)} onChange={e => updateCourse(course.id, 'startHour', timeStrToDecimal(e.target.value))} className="w-full border rounded px-1 py-1" /></td>
                  <td className="p-2"><input type="time" value={formatTime(course.endHour)} onChange={e => updateCourse(course.id, 'endHour', timeStrToDecimal(e.target.value))} className="w-full border rounded px-1 py-1" /></td>
                  <td className="p-2"><input type="number" value={course.credit} onChange={e => updateCourse(course.id, 'credit', Number(e.target.value))} className="w-full border rounded px-1 py-1 w-12" /></td>
                  <td className="p-2"><input value={course.notes} onChange={e => updateCourse(course.id, 'notes', e.target.value)} placeholder="..." className="w-full border rounded px-1 py-1 text-gray-600 min-w-[100px]" /></td>
                  <td className="p-2"><button onClick={() => deleteCourse(course.id)} className="text-red-500 font-bold p-2">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}