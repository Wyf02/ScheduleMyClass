import React, { useState, useEffect, useRef } from 'react';
import { createEvents, type EventAttributes } from 'ics';
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
  // --- UI 状态：控制底部列表是否展开 ---
  const [isListExpanded, setIsListExpanded] = useState(false);

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
 // --- 导出 ICS 日历功能 ---
  const handleExportICS = async () => {
    // 1. 获取学期范围
    const startDateStr = prompt("请输入本学期【第一周的周一】日期 (格式 YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
    if (!startDateStr) return;
    
    const endDateStr = prompt("请输入本学期【最后一周的周日】日期 (格式 YYYY-MM-DD):", "");
    if (!endDateStr) return;

    const semesterStart = new Date(startDateStr);
    const semesterEnd = new Date(endDateStr);

    if (isNaN(semesterStart.getTime()) || isNaN(semesterEnd.getTime())) {
      alert("日期格式错误，请使用 2025-09-01 这种格式");
      return;
    }

    // 2. 准备事件数据
    const events: EventAttributes[] = [];
    
    currentCourses.forEach(course => {
      if (!course.isVisible) return; // 不导出的课程跳过

      // 计算这门课在第一周的具体日期
      // course.day: 1=周一, 2=周二...
      // 第一周周一的日期 + (course.day - 1) 天
      const firstClassDate = new Date(semesterStart);
      firstClassDate.setDate(semesterStart.getDate() + (course.day - 1));

      // 转换时间：例如 9.5 -> [9, 30]
      const startH = Math.floor(course.startHour);
      const startM = Math.round((course.startHour - startH) * 60);
      
      // 持续时间 (分钟)
      const durationMinutes = Math.round((course.endHour - course.startHour) * 60);
      const duration = { hours: Math.floor(durationMinutes / 60), minutes: durationMinutes % 60 };

      // 构建循环规则 (RRULE)
      // FREQ=WEEKLY;UNTIL=20250130T000000Z
      // ics 库只需要我们提供 until 日期即可
      
      events.push({
        start: [firstClassDate.getFullYear(), firstClassDate.getMonth() + 1, firstClassDate.getDate(), startH, startM],
        duration: duration,
        title: course.name,
        description: `备注: ${course.notes || '无'}\n学分: ${course.credit}`,
        location: "本地课表导出",
        recurrenceRule: `FREQ=WEEKLY;UNTIL=${semesterEnd.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        busyStatus: 'BUSY'
      });
    });

    // 3. 生成并下载文件
    createEvents(events, (error, value) => {
      if (error) {
        console.error(error);
        alert("生成日历文件失败");
        return;
      }
      
      const blob = new Blob([value], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${activeSemester?.name || '课表'}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
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
        
        {/* 第一行：标题 + 备份按钮 (手机端优化：一行显示) */}
        <div className="p-3 flex flex-row items-center justify-between border-b border-gray-100 gap-2">
          
          {/* 左侧：标题 + 按钮 (紧挨着) */}
          <div className="flex items-center gap-3 overflow-hidden">
            <h1 className="text-lg font-bold text-gray-800 whitespace-nowrap flex-shrink-0">
              📅 本地课表
            </h1>
            
            {/* 按钮组：直接放在标题旁边 */}
            <div className="flex gap-2">
              <button 
                onClick={handleExport} 
                className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 whitespace-nowrap flex items-center gap-1"
                title="备份数据"
              >
                备份 <span className="hidden sm:inline">📥</span> {/* 极小屏幕只显图标 */}
              </button>
              
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 whitespace-nowrap flex items-center gap-1"
                title="恢复数据"
              >
                恢复 <span className="hidden sm:inline">📤</span>
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
            </div>
            <button 
                onClick={handleExportICS} 
                className="px-2 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded text-xs hover:bg-blue-100 whitespace-nowrap flex items-center gap-1"
                title="导出到手机日历"
              >
                导出ics日历
              </button>
              <a 
                href="https://github.com/Wyf02/ScheduleMyClass" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-2 py-1 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded text-xs hover:bg-indigo-100 whitespace-nowrap flex items-center gap-1 no-underline"
                title="查看使用说明书"
              >
                教程<span className="hidden sm:inline">📖 </span>
              </a>
          </div>

          {/* 右侧：隐私标签 (手机上隐藏，电脑上显示) */}
          <span className="hidden md:inline text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded flex-shrink-0">
            隐私安全: 本地存储
          </span>
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

          <div className="flex gap-2 w-full md:w-auto  md:mt-0">
             {/* 这里的按钮加上 flex-1 让它们在手机上平分宽度 */}
            <button onClick={renameSemester} className="flex-1 md:flex-none text-center px-2 py-1 text-blue-600 border border-blue-200 rounded text-xs hover:bg-blue-50">重命名</button>
            <button onClick={deleteSemester} className="flex-1 md:flex-none text-center px-2 py-1 text-red-500 border border-red-200 rounded text-xs hover:bg-red-50 whitespace-nowrap">
              删除
            </button>
            <button onClick={addSemester} className="flex-1 md:flex-none justify-center px-3 py-1 bg-green-100 text-green-700 border border-green-200 rounded hover:bg-green-200 flex items-center gap-1 whitespace-nowrap">
              ✨ 增加学期
            </button>
            <button onClick={addCourse} className="flex-1 md:flex-none justify-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm flex items-center gap-1 whitespace-nowrap">
              + 添加
            </button>
          </div>
        </div>
      </div>
{/* 中间：周视图 (修复版：网格线分列渲染，杜绝穿模) */}
      <div className="flex-1 overflow-auto relative bg-white touch-pan-x touch-pan-y">
        
        <div className="min-w-[800px] md:min-w-full">
          
          {/* --- 1. 顶部表头行 (Sticky Top) --- */}
          <div className="grid grid-cols-8 sticky top-0 z-40 border-b border-gray-200 bg-gray-50 shadow-sm">
            {/* 左上角死角 */}
            <div className="col-span-1 sticky left-0 top-0 z-50 bg-gray-100 border-r border-gray-200 h-10 flex items-center justify-center text-xs font-bold text-gray-500">
              时 / 周
            </div>
            {/* 星期表头 */}
            {days.map((dayName) => (
              <div key={`header-${dayName}`} className="col-span-1 h-10 flex items-center justify-center text-xs font-bold text-gray-600 border-r border-gray-100 bg-gray-50">
                {dayName}
              </div>
            ))}
          </div>

          {/* --- 2. 下方内容区域 --- */}
          <div className="grid grid-cols-8 pt-5">

            {/* 左侧时间轴 (Sticky Left) */}
            <div className="col-span-1 sticky left-0 z-30 bg-white border-r border-gray-200 h-[600px]">
               {Array.from({ length: totalHours + 1 }).map((_, i) => (
                 <React.Fragment key={i}>
               
                   <div 
                      className="absolute border-t border-gray-200 w-full pointer-events-none"
                      style={{ top: `${(i / totalHours) * 100}%`, left: 0 }}
                   />
                   <div 
                      className="absolute w-full text-right pr-2 text-xs text-gray-400 -mt-2 font-medium" 
                      style={{ top: `${(i / totalHours) * 100}%` }}
                   >
                     <span className="bg-white pl-2 pr-2 relative">
                       {currentStartHour + i}:00
                     </span>
                   </div>
                 </React.Fragment>
               ))}
            </div>

            {/* 课程内容列 */}
            {days.map((dayName, dayIndex) => {
              const dayCourses = currentCourses.filter(c => c.day === dayIndex + 1 && c.isVisible);
              const layoutStyles = getDailyLayout(dayCourses);

              return (
                <div key={`body-${dayName}`} className="col-span-1 relative h-[600px] border-r border-gray-50 bg-white">
                  
                  {/* ✅ 修复点2：每一列自己画背景横线 */}
                  {Array.from({ length: totalHours + 1 }).map((_, i) => (
                    <div 
                      key={`line-${i}`}
                      className="absolute border-t border-gray-100 w-full pointer-events-none"
                      style={{ top: `${(i / totalHours) * 100}%`, left: 0, zIndex: 0 }}
                    />
                  ))}

                  {/* 课程卡片 */}
                  {dayCourses.map(course => {
                    const top = ((course.startHour - currentStartHour) / totalHours) * 100;
                    const height = ((course.endHour - course.startHour) / totalHours) * 100;
                    const overlapStyle = layoutStyles[course.id] || { left: '0%', width: '100%' };

                    return (
                      <div 
                        key={course.id}
                        className="absolute rounded p-1.5 text-xs bg-blue-100 text-blue-900 border-l-4 border-blue-500 overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform shadow-sm group z-10"
                        style={{ 
                          top: `${top}%`, 
                          height: `${height}%`,
                          left: overlapStyle.left,
                          width: overlapStyle.width,
                        }}
                        title={`${course.name}`}
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
      </div>

      {/* 底部：课程编辑列表 (仿手机抽屉效果) */}
      <div 
        className={`bg-white border-t flex flex-col shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-50 transition-[height] duration-500 ease-in-out ${
          isListExpanded ? 'h-[50%]' : 'h-[30%]'
        }`}
      >
        {/* 抽屉把手 / 标题栏 (点击可切换高度) */}
        <div 
          onClick={() => setIsListExpanded(!isListExpanded)}
          className="relative bg-gray-50 border-b cursor-pointer active:bg-gray-100 transition-colors py-2 flex flex-col items-center justify-center flex-shrink-0 touch-none"
        >
          {/* 灰色小横条 (视觉暗示) */}
          <div className="w-10 h-1 bg-gray-300 rounded-full mb-2"></div>
          
          <div className="w-full px-4 flex justify-between items-center text-xs text-gray-500 select-none">
            <span className="font-bold flex items-center gap-1">
              📝 课程管理列表 
              <span className="font-normal text-gray-400">
                ({isListExpanded ? '点击收起' : '点击展开'})
              </span>
            </span>
            <span className="text-gray-400">表格可左右滑动 →</span>
          </div>
        </div>
        
        {/* 表格内容区域 */}
        <div className="flex-1 overflow-auto w-full">
          <table className="w-full text-left text-xs min-w-[800px]">
            <thead className="bg-gray-100 text-gray-600 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-2 w-10 text-center">👁️</th>
                <th className="p-2 min-w-[120px]">课程名称</th>
                <th className="p-2 w-20">周几</th>
                <th className="p-2 w-24">开始</th>
                <th className="p-2 w-24">结束</th>
                <th className="p-2 w-12">学分</th>
                <th className="p-2 min-w-[150px]">备注</th>
                <th className="p-2 w-10">删</th>
              </tr>
            </thead>
            <tbody>
              {currentCourses.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">暂无课程，请点击右上角添加</td></tr>
              ) : (
                currentCourses.map(course => (
                  <tr key={course.id} className="border-b hover:bg-blue-50 transition-colors">
                    <td className="p-2 text-center">
                      <input type="checkbox" checked={course.isVisible} onChange={(e) => updateCourse(course.id, 'isVisible', e.target.checked)} className="w-4 h-4" />
                    </td>
                    <td className="p-2"><input value={course.name} onChange={e => updateCourse(course.id, 'name', e.target.value)} className="w-full border rounded px-1 py-1 min-w-[100px]" /></td>
                    <td className="p-2">
                      <select value={course.day} onChange={e => updateCourse(course.id, 'day', Number(e.target.value))} className="border rounded py-1 w-full">
                        {days.map((d, i) => <option key={i} value={i+1}>{d}</option>)}
                      </select>
                    </td>
                    <td className="p-2"><input type="time" value={formatTime(course.startHour)} onChange={e => updateCourse(course.id, 'startHour', timeStrToDecimal(e.target.value))} className="w-full border rounded px-1 py-1" /></td>
                    <td className="p-2"><input type="time" value={formatTime(course.endHour)} onChange={e => updateCourse(course.id, 'endHour', timeStrToDecimal(e.target.value))} className="w-full border rounded px-1 py-1" /></td>
                    <td className="p-2"><input type="number" value={course.credit} onChange={e => updateCourse(course.id, 'credit', Number(e.target.value))} className="w-full border rounded px-1 py-1 w-12" /></td>
                    <td className="p-2"><input value={course.notes} onChange={e => updateCourse(course.id, 'notes', e.target.value)} placeholder="..." className="w-full border rounded px-1 py-1 text-gray-600 min-w-[100px]" /></td>
                    <td className="p-2"><button onClick={() => deleteCourse(course.id)} className="text-red-500 font-bold p-2">×</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}