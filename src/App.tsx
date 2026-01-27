import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createEvents, type EventAttributes } from 'ics';

// --- 类型定义 ---
interface Course {
  id: string;
  name: string;
  day: number;
  startHour: number;
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
  startHour: number;
  endHour: number;
}

// --- 辅助函数 ---
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

// --- 布局算法 ---
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
        zIndex: style.column + 10
      };
    });
  });

  return layout;
};

export default function CourseScheduler() {
  // --- 状态管理 ---
    // 编辑弹窗相关状态
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);
    const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [semesters, setSemesters] = useState<Semester[]>(() => {
    const saved = localStorage.getItem('my_course_data_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((s: any) => ({
        ...s,
        startHour: s.startHour || 8,
        endHour: s.endHour || 22
      }));
    }
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

  const [isListExpanded, setIsListExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Course | null, direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });

  // --- 交互状态定义 ---
  
  // 1. 调整大小 (Resize)
  const [resizingCourseId, setResizingCourseId] = useState<string | null>(null);
  const resizeRef = useRef<{ startY: number, startEndHour: number } | null>(null);

  // 2. 整体移动 (Move) - 跨天移动需要 gridRef 来计算列宽
  const [movingCourseId, setMovingCourseId] = useState<string | null>(null);
  const moveRef = useRef<{ startY: number, originalStart: number, originalEnd: number } | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null); // ✅ 新增：用于获取整个网格的宽度和位置

  // 3. 拖拽创建 (Create)
  const [creationState, setCreationState] = useState<{ day: number, startHour: number, endHour: number } | null>(null);
  const creationRef = useRef<{ startY: number, baseHour: number } | null>(null);


  useEffect(() => {
    if (!activeSemesterId && semesters.length > 0) {
      setActiveSemesterId(semesters[0].id);
    }
  }, [semesters, activeSemesterId]);

  useEffect(() => {
    localStorage.setItem('my_course_data_v2', JSON.stringify(semesters));
  }, [semesters]);

  const activeSemester = semesters.find(s => s.id === activeSemesterId);
  const currentCourses = activeSemester?.courses || [];
  const currentStartHour = activeSemester?.startHour ?? 8;
  const currentEndHour = activeSemester?.endHour ?? 22;
  const totalHours = currentEndHour - currentStartHour;
  const GRID_HEIGHT = 600; // 固定的 CSS 高度

  // --- CRUD 逻辑 ---
  const updateSemesterConfig = (key: keyof Semester, value: any) => {
    setSemesters(semesters.map(s => s.id === activeSemesterId ? { ...s, [key]: value } : s));
  };
  const updateCurrentCourses = (newCourses: Course[]) => {
    setSemesters(semesters.map(s => s.id === activeSemesterId ? { ...s, courses: newCourses } : s));
  };
  const addCourse = (overrideData?: Partial<Course>) => {
    const newCourse: Course = {
      id: generateId(),
      name: "新日程",
      day: 1,
      startHour: currentStartHour,
      endHour: currentStartHour + 1,
      credit: 2,
      serialNumber: "",
      notes: "",
      isVisible: true,
      ...overrideData
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

  // --- 核心交互逻辑统一处理 ---

  // 1. 开始调整大小 (Resize Start)
  const handleResizeStart = (e: React.MouseEvent, course: Course) => {
    e.stopPropagation(); 
    e.preventDefault();
    setResizingCourseId(course.id);
    resizeRef.current = { startY: e.clientY, startEndHour: course.endHour };
  };

  // 2. 开始移动 (Move Start)
  const handleMoveStart = (e: React.MouseEvent, course: Course) => {
    e.stopPropagation();
    e.preventDefault();
    setMovingCourseId(course.id);
    moveRef.current = { startY: e.clientY, originalStart: course.startHour, originalEnd: course.endHour };
  };

  // 3. 开始创建 (Create Start)
  const handleCreateStart = (e: React.MouseEvent, dayIndex: number) => {
    if ((e.target as HTMLElement).closest('.course-card')) return;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const clickHourOffset = (offsetY / GRID_HEIGHT) * totalHours;
    
    const clickedTime = Math.round((currentStartHour + clickHourOffset) * 2) / 2;

    setCreationState({
      day: dayIndex + 1,
      startHour: clickedTime,
      endHour: clickedTime + 0.5 
    });
    creationRef.current = { startY: e.clientY, baseHour: clickedTime };
  };


  // 全局鼠标监听 (Move & Up)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // 场景 A: 调整大小 (Resize)
      if (resizingCourseId && resizeRef.current) {
        const deltaY = e.clientY - resizeRef.current.startY;
        const deltaHours = (deltaY / GRID_HEIGHT) * totalHours;
        const rawNewEndHour = resizeRef.current.startEndHour + deltaHours;
        const snappedEndHour = Math.round(rawNewEndHour * 4) / 4; 
        
        const course = currentCourses.find(c => c.id === resizingCourseId);
        if (course) {
           const validEndHour = Math.max(course.startHour + 0.5, Math.min(snappedEndHour, currentEndHour));
           updateCourse(resizingCourseId, 'endHour', validEndHour);
        }
      }

      // 场景 B: 整体移动 (Move) - ✅ 已升级：支持跨列拖拽
      if (movingCourseId && moveRef.current && gridContainerRef.current) {
        // 1. 计算时间 (Y轴)
        const deltaY = e.clientY - moveRef.current.startY;
        const deltaHours = (deltaY / GRID_HEIGHT) * totalHours;
        
        let newStart = moveRef.current.originalStart + deltaHours;
        newStart = Math.round(newStart * 4) / 4; // 吸附 15 分钟
        const duration = moveRef.current.originalEnd - moveRef.current.originalStart;
        let newEnd = newStart + duration;

        // 边界限制 (Y轴)
        if (newStart < currentStartHour) { newStart = currentStartHour; newEnd = newStart + duration; }
        if (newEnd > currentEndHour) { newEnd = currentEndHour; newStart = newEnd - duration; }

        // 2. 计算天 (X轴) - ✅ 核心逻辑
        const gridRect = gridContainerRef.current.getBoundingClientRect();
        const relativeX = e.clientX - gridRect.left; // 鼠标在网格内的 X 坐标
        const colWidth = gridRect.width / 8; // 网格被分为 8 列 (1时间轴 + 7天)
        
        // 计算当前鼠标在哪一列
        // 第 0 列是时间轴，第 1 列是周一，第 7 列是周日
        let newDay = Math.floor(relativeX / colWidth);
        
        // 限制范围在 1-7 之间 (防止拖到时间轴左边或周日右边)
        newDay = Math.max(1, Math.min(newDay, 7));

        // 更新状态
        const updated = currentCourses.map(c => 
          c.id === movingCourseId ? { ...c, startHour: newStart, endHour: newEnd, day: newDay } : c
        );
        updateCurrentCourses(updated);
      }

      // 场景 C: 拖拽创建 (Create)
      if (creationState && creationRef.current) {
        const deltaY = e.clientY - creationRef.current.startY;
        const deltaHours = (deltaY / GRID_HEIGHT) * totalHours;
        
        let currentDragTime = creationRef.current.baseHour + deltaHours;
        currentDragTime = Math.round(currentDragTime * 2) / 2;

        const newStart = Math.min(creationRef.current.baseHour, currentDragTime);
        const newEnd = Math.max(creationRef.current.baseHour, currentDragTime);
        const finalEnd = Math.max(newEnd, newStart + 0.5);

        setCreationState(prev => prev ? { ...prev, startHour: newStart, endHour: finalEnd } : null);
      }
    };

    const handleMouseUp = () => {
      if (resizingCourseId) { setResizingCourseId(null); resizeRef.current = null; }
      if (movingCourseId) { setMovingCourseId(null); moveRef.current = null; }
      if (creationState) {
        addCourse({ day: creationState.day, startHour: creationState.startHour, endHour: creationState.endHour, name: "新日程" });
        setCreationState(null);
        creationRef.current = null;
      }
    };

    if (resizingCourseId || movingCourseId || creationState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCourseId, movingCourseId, creationState, currentCourses, totalHours, currentStartHour, currentEndHour]);


  // --- 排序处理 ---
  const handleSort = (key: keyof Course) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const processedCourses = useMemo(() => {
    let result = [...currentCourses];
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(lowerTerm) || c.notes.toLowerCase().includes(lowerTerm));
    }
    if (sortConfig.key) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key!] ?? '';
        const valB = b[sortConfig.key!] ?? '';
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [currentCourses, searchTerm, sortConfig]);

  // ... (保留其他未修改的函数: addSemester, deleteSemester, renameSemester, handleExport, handleExportICS, handleImport) ...
  const addSemester = () => {
     const name = prompt("请输入新学期名称:", "新学期");
     if (!name) return;
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
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(semesters, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `课表备份_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };
  const handleExportICS = async () => {
    const startDateStr = prompt("请输入本学期【第一周的周一】日期 (格式 YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
    if (!startDateStr) return;
    const endDateStr = prompt("请输入本学期【最后一周的周日】日期 (格式 YYYY-MM-DD):", "");
    if (!endDateStr) return;
    const semesterStart = new Date(startDateStr);
    const semesterEnd = new Date(endDateStr);

    const events: EventAttributes[] = [];
    currentCourses.forEach(course => {
      if (!course.isVisible) return;
      const firstClassDate = new Date(semesterStart);
      firstClassDate.setDate(semesterStart.getDate() + (course.day - 1));
      const startH = Math.floor(course.startHour);
      const startM = Math.round((course.startHour - startH) * 60);
      const durationMinutes = Math.round((course.endHour - course.startHour) * 60);
      const duration = { hours: Math.floor(durationMinutes / 60), minutes: durationMinutes % 60 };
      
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
    createEvents(events, (error, value) => {
       if (error) return alert("生成失败");
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
           const compatible = json.map((s: any) => ({
              ...s, startHour: s.startHour || 8, endHour: s.endHour || 22
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
  
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  return (
    <div className="h-screen flex flex-col bg-gray-50 text-sm font-sans select-none">
      
      {/* 顶部控制栏 */}
      <div className="bg-white border-b shadow-sm z-20 flex-shrink-0">
        <div className="p-3 flex flex-row items-center justify-between border-b border-gray-100 gap-2">
          <div className="flex items-center gap-3 overflow-hidden">
            <h1 className="text-lg font-bold text-gray-800 whitespace-nowrap flex-shrink-0">
              📅 本地课表
            </h1>
            <div className="flex gap-2">
              <a href="https://github.com/wyf02/ScheduleMyClass/blob/main/README.md" target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded text-xs hover:bg-indigo-100 whitespace-nowrap flex items-center gap-1 no-underline">📖 <span className="hidden sm:inline">教程</span></a>
              <button onClick={handleExportICS} className="px-2 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded text-xs hover:bg-blue-100 whitespace-nowrap flex items-center gap-1">🗓️ <span className="hidden sm:inline">日历</span></button>
              <button onClick={handleExport} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 whitespace-nowrap flex items-center gap-1">📥 <span className="hidden sm:inline">备份</span></button>
              <button onClick={() => fileInputRef.current?.click()} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 whitespace-nowrap flex items-center gap-1">📤 <span className="hidden sm:inline">恢复</span></button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
            </div>
          </div>
          <span className="hidden md:inline text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded flex-shrink-0">隐私安全: 本地存储</span>
        </div>

        <div className="p-3 flex flex-wrap items-center justify-between gap-3 bg-blue-50/50">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <label className="text-gray-600 font-medium whitespace-nowrap">学期：</label>
            <select value={activeSemesterId} onChange={(e) => setActiveSemesterId(e.target.value)} className="flex-1 md:flex-none border border-blue-200 rounded px-2 py-1 text-blue-900 font-bold bg-white outline-none min-w-[120px]">
              {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="flex items-center gap-1 text-gray-600 bg-white px-2 py-1 rounded border border-blue-100 ml-auto md:ml-2">
              <span className="text-xs text-gray-400">时间:</span>
              <input type="number" value={currentStartHour} onChange={(e) => updateSemesterConfig('startHour', Number(e.target.value))} className="w-8 text-center border rounded bg-gray-50 text-xs py-0.5"/>
              <span className="text-xs">-</span>
              <input type="number" value={currentEndHour} onChange={(e) => updateSemesterConfig('endHour', Number(e.target.value))} className="w-8 text-center border rounded bg-gray-50 text-xs py-0.5"/>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto md:mt-0">
            <button onClick={renameSemester} className="flex-1 md:flex-none text-center px-2 py-1 text-blue-600 border border-blue-200 rounded text-xs hover:bg-blue-50">重命名</button>
            <button onClick={deleteSemester} className="flex-1 md:flex-none text-center px-2 py-1 text-red-500 border border-red-200 rounded text-xs hover:bg-red-50 whitespace-nowrap">删除</button>
            <button onClick={addSemester} className="flex-1 md:flex-none justify-center px-3 py-1 bg-green-100 text-green-700 border border-green-200 rounded hover:bg-green-200 flex items-center gap-1 whitespace-nowrap">✨ 增加学期</button>
            <button onClick={() => addCourse()} className="flex-1 md:flex-none justify-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm flex items-center gap-1 whitespace-nowrap">+ 添加</button>
          </div>
        </div>
      </div>

      {/* 中间：周视图 */}
      <div className="flex-1 overflow-auto relative bg-white touch-pan-x touch-pan-y cursor-crosshair">
        <div className="min-w-[800px] md:min-w-full">
          {/* 表头 */}
          <div className="grid grid-cols-8 sticky top-0 z-40 border-b border-gray-200 bg-gray-50 shadow-sm">
            <div className="col-span-1 sticky left-0 top-0 z-50 bg-gray-100 border-r border-gray-200 h-10 flex items-center justify-center text-xs font-bold text-gray-500">时 / 周</div>
            {days.map((dayName) => (
              <div key={`header-${dayName}`} className="col-span-1 h-10 flex items-center justify-center text-xs font-bold text-gray-600 border-r border-gray-100 bg-gray-50">{dayName}</div>
            ))}
          </div>

          {/* ✅ 网格容器增加 ref={gridContainerRef} */}
          <div className="grid grid-cols-8 pt-5" ref={gridContainerRef}>
            {/* 时间轴 */}
            <div className="col-span-1 sticky left-0 z-30 bg-white border-r border-gray-200 h-[600px]">
               {Array.from({ length: totalHours + 1 }).map((_, i) => (
                 <React.Fragment key={i}>
                   <div className="absolute border-t border-gray-200 w-full pointer-events-none" style={{ top: `${(i / totalHours) * 100}%`, left: 0 }}/>
                   <div className="absolute w-full text-right pr-2 text-xs text-gray-400 -mt-2 font-medium" style={{ top: `${(i / totalHours) * 100}%` }}>
                     <span className="bg-white pl-2 pr-2 relative">{currentStartHour + i}:00</span>
                   </div>
                 </React.Fragment>
               ))}
            </div>

            {/* 课程内容列 */}
            {days.map((dayName, dayIndex) => {
              const dayCourses = currentCourses.filter(c => c.day === dayIndex + 1 && c.isVisible);
              const layoutStyles = getDailyLayout(dayCourses);

              return (
                <div 
                  key={`body-${dayName}`} 
                  className="col-span-1 relative h-[600px] border-r border-gray-50 bg-white hover:bg-gray-50 transition-colors"
                  onMouseDown={(e) => handleCreateStart(e, dayIndex)}
                >
                  {/* 背景线 */}
                  {Array.from({ length: totalHours + 1 }).map((_, i) => (
                    <div key={`line-${i}`} className="absolute border-t border-gray-100 w-full pointer-events-none" style={{ top: `${(i / totalHours) * 100}%`, left: 0, zIndex: 0 }} />
                  ))}

                  {/* 拖拽创建时的“幽灵卡片” */}
                  {creationState && creationState.day === dayIndex + 1 && (
                    <div 
                      className="absolute rounded p-1.5 text-xs bg-green-100/50 border-2 border-green-500 border-dashed z-50 pointer-events-none"
                      style={{
                        left: '5%',
                        width: '90%',
                        top: `${((creationState.startHour - currentStartHour) / totalHours) * 100}%`,
                        height: `${((creationState.endHour - creationState.startHour) / totalHours) * 100}%`
                      }}
                    >
                      <div className="font-bold text-green-700">新日程...</div>
                      <div className="text-green-600">{formatTime(creationState.startHour)} - {formatTime(creationState.endHour)}</div>
                    </div>
                  )}

                  {dayCourses.map(course => {
                    const top = ((course.startHour - currentStartHour) / totalHours) * 100;
                    const height = ((course.endHour - course.startHour) / totalHours) * 100;
                    const overlapStyle = layoutStyles[course.id] || { left: '0%', width: '100%' };

                    const isResizing = resizingCourseId === course.id;
                    const isMoving = movingCourseId === course.id;

                    return (
                      <div 
                        key={course.id}
                        className={`absolute rounded p-1.5 text-xs bg-blue-100 text-blue-900 border-l-4 border-blue-500 overflow-hidden shadow-sm group z-10 course-card 
                          ${isResizing ? 'opacity-80 ring-2 ring-blue-400 z-50' : ''} 
                          ${isMoving ? 'opacity-50 ring-2 ring-blue-400 z-50 cursor-grabbing shadow-xl' : 'cursor-grab hover:scale-[1.02]'}`}
                        style={{ 
                          top: `${top}%`, 
                          height: `${height}%`, 
                          left: overlapStyle.left, 
                          width: overlapStyle.width,
                          transition: isMoving || isResizing ? 'none' : 'transform 0.1s'
                        }}
                        onMouseDown={(e) => handleMoveStart(e, course)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCourse(course);
                          setIsEditDrawerOpen(true);
                        }}
                      >
                        <div className="font-bold leading-tight truncate">{course.name}</div>
                        <div className="opacity-80 scale-90 origin-left mt-1 truncate">{formatTime(course.startHour)} - {formatTime(course.endHour)}</div>
                        {/* 调整大小的手柄 */}
                        <div 
                           className="absolute bottom-0 left-0 w-full h-3 cursor-ns-resize flex justify-center items-end pb-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                           onMouseDown={(e) => handleResizeStart(e, course)}
                        >
                           <div className="w-8 h-1 bg-blue-300 rounded-full"></div>
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

      {/* 底部：课程编辑列表 */}
      <div className={`bg-white border-t flex flex-col shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-50 transition-[height] duration-500 ease-in-out ${isListExpanded ? 'h-[60%]' : 'h-[30%]'}`}>
        <div onClick={() => setIsListExpanded(!isListExpanded)} className="relative bg-gray-50 border-b cursor-pointer active:bg-gray-100 transition-colors py-2 flex flex-col items-center justify-center flex-shrink-0 touch-none">
          <div className="w-10 h-1 bg-gray-300 rounded-full mb-2"></div>
          <div className="w-full px-4 flex justify-between items-center text-xs text-gray-500 select-none">
            <span className="font-bold flex items-center gap-1">📝 列表 <span className="font-normal text-gray-400">({isListExpanded ? '收起' : '展开'})</span></span>
            <input 
              type="text" 
              placeholder="🔍 搜索课程..." 
              value={searchTerm}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border rounded px-2 py-0.5 text-xs w-32 focus:w-48 transition-all outline-none"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-auto w-full">
          <table className="w-full text-left text-xs min-w-[800px]">
            <thead className="bg-gray-100 text-gray-600 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-2 w-10 text-center">👁️</th>
                <th className="p-2 min-w-[120px] cursor-pointer hover:bg-gray-200" onClick={() => handleSort('name')}>
                  课程名称 {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="p-2 w-20 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('day')}>
                  周几 {sortConfig.key === 'day' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="p-2 w-24 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('startHour')}>
                  开始 {sortConfig.key === 'startHour' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="p-2 w-24">结束</th>
                <th className="p-2 w-12 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('credit')}>
                   学分 {sortConfig.key === 'credit' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="p-2 min-w-[150px]">备注</th>
                <th className="p-2 w-10">删</th>
              </tr>
            </thead>
            <tbody>
              {processedCourses.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">无匹配课程</td></tr>
              ) : (
                processedCourses.map(course => (
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
    {/* 右侧编辑弹窗 */}
    {isEditDrawerOpen && editingCourse && (
      <div className="fixed top-0 right-0 h-full w-full max-w-xs bg-white shadow-2xl border-l z-[999] flex flex-col animate-slideIn" style={{minWidth:320}}>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="font-bold text-lg text-blue-700">编辑日程</div>
          <button onClick={() => setIsEditDrawerOpen(false)} className="text-gray-400 hover:text-blue-500 text-2xl">×</button>
        </div>
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
          <label className="block">
            <span className="text-xs text-gray-500">名称</span>
            <input className="w-full border rounded px-2 py-1 mt-1" value={editingCourse.name} onChange={e => setEditingCourse({...editingCourse, name: e.target.value})} />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">周几</span>
            <select className="w-full border rounded px-2 py-1 mt-1" value={editingCourse.day} onChange={e => setEditingCourse({...editingCourse, day: Number(e.target.value)})}>
              {days.map((d, i) => <option key={i} value={i+1}>{d}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">开始时间</span>
            <input className="w-full border rounded px-2 py-1 mt-1" type="time" value={formatTime(editingCourse.startHour)} onChange={e => setEditingCourse({...editingCourse, startHour: timeStrToDecimal(e.target.value)})} />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">结束时间</span>
            <input className="w-full border rounded px-2 py-1 mt-1" type="time" value={formatTime(editingCourse.endHour)} onChange={e => setEditingCourse({...editingCourse, endHour: timeStrToDecimal(e.target.value)})} />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">学分</span>
            <input className="w-full border rounded px-2 py-1 mt-1" type="number" value={editingCourse.credit} onChange={e => setEditingCourse({...editingCourse, credit: Number(e.target.value)})} />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">备注</span>
            <input className="w-full border rounded px-2 py-1 mt-1" value={editingCourse.notes} onChange={e => setEditingCourse({...editingCourse, notes: e.target.value})} />
          </label>
        </div>
        <div className="flex gap-2 p-4 border-t">
          <button className="flex-1 bg-blue-600 text-white rounded px-3 py-2 font-bold hover:bg-blue-700" onClick={() => {
            // 一次性整体替换该课程
            updateCurrentCourses(currentCourses.map(c => c.id === editingCourse.id ? { ...editingCourse } : c));
            setIsEditDrawerOpen(false);
          }}>保存</button>
          <button className="flex-1 bg-red-500 text-white rounded px-3 py-2 font-bold hover:bg-red-600" onClick={() => {
            deleteCourse(editingCourse.id);
            setIsEditDrawerOpen(false);
          }}>删除</button>
        </div>
      </div>
    )}
  </div>
  );
}