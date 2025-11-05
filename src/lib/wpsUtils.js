const allMaterials = [
      { name: 'DD11', standard: 'EN 10111', group: 'Düşük Karbonlu Çelikler', carbon_equivalent: 0.20, wire: 'G3Si1', gas: 'M20' },
      { name: 'DD13', standard: 'EN 10111', group: 'Düşük Karbonlu Çelikler', carbon_equivalent: 0.18, wire: 'G3Si1', gas: 'M20' },
      { name: 'S235JR', standard: 'EN 10025-2', group: 'Yapısal Çelikler', carbon_equivalent: 0.35, wire: 'G3Si1', gas: 'M20' },
      { name: 'S235J0', standard: 'EN 10025-2', group: 'Yapısal Çelikler', carbon_equivalent: 0.35, wire: 'G3Si1', gas: 'M20' },
      { name: 'S235J2', standard: 'EN 10025-2', group: 'Yapısal Çelikler', carbon_equivalent: 0.35, wire: 'G3Si1', gas: 'M20' },
      { name: 'S355JR', standard: 'EN 10025-2', group: 'Yapısal Çelikler', carbon_equivalent: 0.45, wire: 'G3Si1', gas: 'M20' },
      { name: 'S355J0', standard: 'EN 10025-2', group: 'Yapısal Çelikler', carbon_equivalent: 0.45, wire: 'G3Si1', gas: 'M20' },
      { name: 'S355J2', standard: 'EN 10025-2', group: 'Yapısal Çelikler', carbon_equivalent: 0.45, wire: 'G3Si1', gas: 'M20' },
      { name: '304/304L', standard: 'ASTM A240', group: 'Östenitik Paslanmaz Çelikler', carbon_equivalent: null, wire: '308LSi', gas: 'M12' },
      { name: '316/316L', standard: 'ASTM A240', group: 'Östenitik Paslanmaz Çelikler', carbon_equivalent: null, wire: '316LSi', gas: 'M12' },
    ];
    
    export const materialGroups = allMaterials.reduce((acc, m) => {
      acc[m.group] = acc[m.group] || [];
      acc[m.group].push(m);
      return acc;
    }, {});
    
    export const jointTypes = ['Plaka/Plaka', 'Boru/Plaka', 'Boru/Boru'];
    export const jointDesigns = ['Küt (I) Kaynağı', 'Tek V Kaynağı', 'Çift V (X) Kaynağı', 'Tek U Kaynağı', 'Köşe Kaynağı'];
    export const weldingProcesses = { 'MAG (135)': 0.8, 'MIG (131)': 0.8, 'TIG (141)': 0.6 };
    export const positions = { 'PA': 'PA (Düz)', 'PB': 'PB (Yatay Köşe)', 'PC': 'PC (Yatay)', 'PD': 'PD (Tavan Köşe)', 'PE': 'PE (Tavan)', 'PF': 'PF (Dikey Yukarı)', 'PG': 'PG (Dikey Aşağı)' };
    export const gasTypes = [{ name: 'M20', desc: 'Ar + 5-15% CO₂' }, { name: 'M21', desc: 'Ar + 15-25% CO₂' }, { name: 'M12', desc: 'Ar + 1-2% O₂/CO₂' }, { name: 'M13', desc: 'Ar + 1-3% CO₂' }, { name: 'C1', desc: '100% CO₂' }, { name: 'I1', desc: '100% Ar' }];
    export const wireTypes = [{ name: 'G3Si1', desc: 'ER70S-6' }, { name: 'G4Si1', desc: 'ER70S-7' }, { name: '308LSi', desc: 'Paslanmaz 304L' }, { name: '316LSi', desc: 'Paslanmaz 316L' }];
    
    const updatedParamTable = [
        { thickness: 2, wireDiameter: 1.0, current: 150, voltage: 18.0, wireSpeed: 4.5, dynamic: 3 },
        { thickness: 2, wireDiameter: 1.2, current: 155, voltage: 18.5, wireSpeed: 4.2, dynamic: 3 },
        { thickness: 3, wireDiameter: 1.0, current: 160, voltage: 19.0, wireSpeed: 5.0, dynamic: 2 },
        { thickness: 3, wireDiameter: 1.2, current: 170, voltage: 19.5, wireSpeed: 4.8, dynamic: 2 },
        { thickness: 4, wireDiameter: 1.0, current: 180, voltage: 20.0, wireSpeed: 5.8, dynamic: 2 },
        { thickness: 4, wireDiameter: 1.2, current: 190, voltage: 20.5, wireSpeed: 5.5, dynamic: 2 },
        { thickness: 5, wireDiameter: 1.0, current: 200, voltage: 21.0, wireSpeed: 6.5, dynamic: 1 },
        { thickness: 5, wireDiameter: 1.2, current: 210, voltage: 21.5, wireSpeed: 6.2, dynamic: 1 },
        { thickness: 6, wireDiameter: 1.0, current: 220, voltage: 22.0, wireSpeed: 7.5, dynamic: 1 },
        { thickness: 6, wireDiameter: 1.2, current: 230, voltage: 22.5, wireSpeed: 7.0, dynamic: 1 },
        { thickness: 8, wireDiameter: 1.0, current: 240, voltage: 23.5, wireSpeed: 8.5, dynamic: 0 },
        { thickness: 8, wireDiameter: 1.2, current: 250, voltage: 24.0, wireSpeed: 8.0, dynamic: 0 },
        { thickness: 10, wireDiameter: 1.0, current: 260, voltage: 25.0, wireSpeed: 9.5, dynamic: 0 },
        { thickness: 10, wireDiameter: 1.2, current: 275, voltage: 26.0, wireSpeed: 9.0, dynamic: 0 },
    ];
    
    const getJointDesignSuggestion = (thickness) => {
      const t = parseFloat(thickness);
      if (t <= 3) return { joint_design: 'Küt (I) Kaynağı', root_gap: '0-1' };
      if (t <= 12) return { joint_design: 'Tek V Kaynağı', root_gap: '1-2' };
      return { joint_design: 'Çift V (X) Kaynağı', root_gap: '1-3' };
    };
    
    export const calculateHeatInput = (voltage, current, travelSpeedMmSn, process) => {
        const k = weldingProcesses[process] || 0.8;
        if (!voltage || !current || !travelSpeedMmSn || travelSpeedMmSn === 0) return '';
        const avgVoltage = (parseFloat(voltage.split('-')[0]) + parseFloat(voltage.split('-')[1] || voltage.split('-')[0])) / 2;
        const avgCurrent = (parseFloat(current.split('-')[0]) + parseFloat(current.split('-')[1] || current.split('-')[0])) / 2;
        const heatInput = (avgVoltage * avgCurrent * k) / (parseFloat(travelSpeedMmSn) * 1000);
        return heatInput.toFixed(4);
    };
    
    export const calculateRobotSpeed = (wireFeedSpeed) => {
        const wfs = parseFloat(wireFeedSpeed);
        if (!wfs) return '';
        const robotSpeedMmsn = (wfs * 2) - 1;
        return robotSpeedMmsn.toFixed(0);
    };
    
    export const getSuggestions = (formData) => {
      const { part1, part2, wire_diameter, joint_type, welding_process } = formData;
      const material1 = allMaterials.find(m => m.name === part1.material_type);
      const material2 = allMaterials.find(m => m.name === part2.material_type);
    
      const primaryMaterial = material1 || material2;
      
      let thickness;
      if (joint_type === 'Plaka/Plaka') {
        thickness = parseFloat(part1.thickness || part2.thickness);
      } else if (joint_type === 'Boru/Plaka') {
        thickness = parseFloat(part1.pipe_wt || part2.thickness);
      } else if (joint_type === 'Boru/Boru') {
        thickness = parseFloat(part1.pipe_wt || part2.pipe_wt);
      } else {
        thickness = parseFloat(part1.thickness || part1.pipe_wt || part2.thickness || part2.pipe_wt);
      }
    
      const d = parseFloat(wire_diameter);
    
      if (!primaryMaterial || !thickness) return {};
    
      let suggestions = {};
    
      if (d) {
        const closestThickness = updatedParamTable.reduce((prev, curr) => {
          return (Math.abs(curr.thickness - thickness) < Math.abs(prev.thickness - thickness) ? curr : prev);
        });
    
        let match = updatedParamTable.find(p => p.thickness === thickness && p.wireDiameter === d);
        if (!match) {
          const thicknessMatches = updatedParamTable.filter(p => p.thickness === closestThickness.thickness);
          if (thicknessMatches.length > 0) {
            match = thicknessMatches.find(p => p.wireDiameter === d) || thicknessMatches[0];
          } else {
            match = closestThickness;
          }
        }
    
        if (match) {
          const currentRange = `${match.current - 10}-${match.current + 10}`;
          const voltageRange = `${(match.voltage - 0.5).toFixed(1)}-${(match.voltage + 0.5).toFixed(1)}`;
          const robotSpeed = calculateRobotSpeed(match.wireSpeed);
          const heatInput = calculateHeatInput(voltageRange, currentRange, robotSpeed, welding_process);
    
          suggestions = {
            wire_feed_speed: match.wireSpeed.toString(),
            current_range: currentRange,
            voltage_range: voltageRange,
            robot_speed: robotSpeed,
            heat_input: heatInput,
            dynamic_correction: match.dynamic.toString(),
            arc_length: '0',
          };
        }
      }
      
      let preheatTemp = '';
      let preheatInfo = 'Malzeme ve kalınlığa göre ön ısıtma gerekmeyebilir.';
      if (primaryMaterial.carbon_equivalent) {
        const ce = primaryMaterial.carbon_equivalent;
        if (ce > 0.45 || (ce > 0.4 && thickness > 25)) {
          let temp = 100 + (thickness - 25) * 2 + (ce - 0.4) * 500;
          temp = Math.max(100, Math.round(temp / 25) * 25);
          preheatTemp = `${temp - 20}-${temp + 20} °C`;
          preheatInfo = `EN 1011-2'ye göre, ${thickness}mm kalınlık ve ${ce} CE değeri için hidrojen çatlağı riskini azaltmak amacıyla ~${temp}°C ön ısıtma önerilir.`;
        }
      } else {
        preheatInfo = 'Paslanmaz çelikler için genellikle ön ısıtma gerekmez.';
      }
    
      const jointDesign = getJointDesignSuggestion(thickness);
    
      return {
        welding_process: primaryMaterial.group.includes('Paslanmaz') ? 'MIG (131)' : 'MAG (135)',
        wire_type: primaryMaterial.wire,
        gas_type: 'M20',
        gas_flow: '12-15',
        inter_pass: primaryMaterial.group.includes('Paslanmaz') ? 'max 150 °C' : 'max 250 °C',
        pre_heat: preheatTemp,
        pre_heat_info: preheatInfo,
        ...jointDesign,
        ...suggestions,
      };
    };
    
    export const validateWPS = (formData) => {
      const errors = [];
      const { joint_type, position, part1, part2, welding_process, wire_type, wire_diameter, gas_type } = formData;
    
      if (!joint_type || !position || !welding_process) errors.push('Temel Bilgiler');
      
      const validatePart = (part, partName, isPipe) => {
        if (!part.material_type) errors.push(`${partName} Malzeme`);
        if (isPipe) {
          if (!part.pipe_od) errors.push(`${partName} Dış Çap`);
          if (!part.pipe_wt) errors.push(`${partName} Et Kalınlığı`);
        } else {
          if (!part.thickness) errors.push(`${partName} Kalınlık`);
        }
      };
    
      const isPart1Pipe = joint_type === 'Boru/Plaka' || joint_type === 'Boru/Boru';
      const isPart2Pipe = joint_type === 'Boru/Boru';
      
      validatePart(part1, 'Parça 1', isPart1Pipe);
      validatePart(part2, 'Parça 2', isPart2Pipe);
    
    
      if (!wire_type || !wire_diameter || !gas_type) errors.push('Sarf Malzemeler');
    
      return [...new Set(errors)];
    };