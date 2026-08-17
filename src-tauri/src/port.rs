use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use windows::Win32::NetworkManagement::IpHelper::{
    GetExtendedTcpTable, GetExtendedUdpTable, 
    MIB_TCPTABLE_OWNER_PID, MIB_TCP6TABLE_OWNER_PID,
    MIB_UDPTABLE_OWNER_PID, MIB_UDP6TABLE_OWNER_PID,
    TCP_TABLE_OWNER_PID_ALL, UDP_TABLE_OWNER_PID,
};
use windows::Win32::Networking::WinSock::{AF_INET, AF_INET6};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortInfo {
    pub port: u16,
    pub protocol: String,
    pub state: String,
    pub local_address: String,
    pub remote_address: String,
    pub pid: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TcpConnection {
    pub local_address: String,
    pub local_port: u16,
    pub remote_address: String,
    pub remote_port: u16,
    pub state: String,
    pub pid: u32,
}

// IPv4 TCP 连接
fn get_tcp_connections_v4() -> Result<Vec<TcpConnection>, String> {
    unsafe {
        let mut size: u32 = 0;
        
        let _ = GetExtendedTcpTable(
            None,
            &mut size,
            false,
            AF_INET.0 as u32,
            TCP_TABLE_OWNER_PID_ALL,
            0,
        );

        let mut buffer = vec![0u8; size as usize];
        
        let result = GetExtendedTcpTable(
            Some(buffer.as_mut_ptr() as *mut _),
            &mut size,
            false,
            AF_INET.0 as u32,
            TCP_TABLE_OWNER_PID_ALL,
            0,
        );
        
        if result != 0 {
            return Err(format!("Failed to get IPv4 TCP table: error code {}", result));
        }

        let table = &*(buffer.as_ptr() as *const MIB_TCPTABLE_OWNER_PID);
        let entries = std::slice::from_raw_parts(
            table.table.as_ptr(),
            table.dwNumEntries as usize,
        );

        let connections = entries
            .iter()
            .map(|entry| {
                let local_addr = IpAddr::from(u32::from_be(entry.dwLocalAddr).to_be_bytes());
                let remote_addr = IpAddr::from(u32::from_be(entry.dwRemoteAddr).to_be_bytes());
                let local_port = u16::from_be((entry.dwLocalPort as u16).to_le());
                let remote_port = u16::from_be((entry.dwRemotePort as u16).to_le());

                TcpConnection {
                    local_address: local_addr.to_string(),
                    local_port,
                    remote_address: remote_addr.to_string(),
                    remote_port,
                    state: get_tcp_state(entry.dwState),
                    pid: entry.dwOwningPid,
                }
            })
            .collect();

        Ok(connections)
    }
}

// IPv6 TCP 连接
fn get_tcp_connections_v6() -> Result<Vec<TcpConnection>, String> {
    unsafe {
        let mut size: u32 = 0;
        
        let _ = GetExtendedTcpTable(
            None,
            &mut size,
            false,
            AF_INET6.0 as u32,
            TCP_TABLE_OWNER_PID_ALL,
            0,
        );

        let mut buffer = vec![0u8; size as usize];
        
        let result = GetExtendedTcpTable(
            Some(buffer.as_mut_ptr() as *mut _),
            &mut size,
            false,
            AF_INET6.0 as u32,
            TCP_TABLE_OWNER_PID_ALL,
            0,
        );
        
        if result != 0 {
            return Err(format!("Failed to get IPv6 TCP table: error code {}", result));
        }

        let table = &*(buffer.as_ptr() as *const MIB_TCP6TABLE_OWNER_PID);
        let entries = std::slice::from_raw_parts(
            table.table.as_ptr(),
            table.dwNumEntries as usize,
        );

        let connections = entries
            .iter()
            .map(|entry| {
                // IPv6 地址是 16 字节数组
                let local_addr = IpAddr::from(entry.ucLocalAddr);
                let remote_addr = IpAddr::from(entry.ucRemoteAddr);
                let local_port = u16::from_be((entry.dwLocalPort as u16).to_le());
                let remote_port = u16::from_be((entry.dwRemotePort as u16).to_le());

                TcpConnection {
                    local_address: format!("[{}]", local_addr),  // IPv6 用方括号
                    local_port,
                    remote_address: format!("[{}]", remote_addr),
                    remote_port,
                    state: get_tcp_state(entry.dwState),
                    pid: entry.dwOwningPid,
                }
            })
            .collect();

        Ok(connections)
    }
}

// 合并 IPv4 和 IPv6 TCP 连接
pub fn get_tcp_connections() -> Result<Vec<TcpConnection>, String> {
    // 严格模式：两个协议族都必须成功
    let v4 = get_tcp_connections_v4()?;
    let v6 = get_tcp_connections_v6()?;
    
    let mut all_connections = v4;
    all_connections.extend(v6);
    
    Ok(all_connections)
}

// IPv4 UDP 监听
fn get_udp_listeners_v4() -> Result<Vec<PortInfo>, String> {
    unsafe {
        let mut size: u32 = 0;
        
        let _ = GetExtendedUdpTable(
            None,
            &mut size,
            false,
            AF_INET.0 as u32,
            UDP_TABLE_OWNER_PID,
            0,
        );

        let mut buffer = vec![0u8; size as usize];
        
        let result = GetExtendedUdpTable(
            Some(buffer.as_mut_ptr() as *mut _),
            &mut size,
            false,
            AF_INET.0 as u32,
            UDP_TABLE_OWNER_PID,
            0,
        );
        
        if result != 0 {
            return Err(format!("Failed to get IPv4 UDP table: error code {}", result));
        }

        let table = &*(buffer.as_ptr() as *const MIB_UDPTABLE_OWNER_PID);
        let entries = std::slice::from_raw_parts(
            table.table.as_ptr(),
            table.dwNumEntries as usize,
        );

        let listeners = entries
            .iter()
            .map(|entry| {
                let local_addr = IpAddr::from(u32::from_be(entry.dwLocalAddr).to_be_bytes());
                let local_port = u16::from_be((entry.dwLocalPort as u16).to_le());

                PortInfo {
                    port: local_port,
                    protocol: "UDP".to_string(),
                    state: "LISTENING".to_string(),
                    local_address: local_addr.to_string(),
                    remote_address: String::new(),
                    pid: entry.dwOwningPid,
                }
            })
            .collect();

        Ok(listeners)
    }
}

// IPv6 UDP 监听
fn get_udp_listeners_v6() -> Result<Vec<PortInfo>, String> {
    unsafe {
        let mut size: u32 = 0;
        
        let _ = GetExtendedUdpTable(
            None,
            &mut size,
            false,
            AF_INET6.0 as u32,
            UDP_TABLE_OWNER_PID,
            0,
        );

        let mut buffer = vec![0u8; size as usize];
        
        let result = GetExtendedUdpTable(
            Some(buffer.as_mut_ptr() as *mut _),
            &mut size,
            false,
            AF_INET6.0 as u32,
            UDP_TABLE_OWNER_PID,
            0,
        );
        
        if result != 0 {
            return Err(format!("Failed to get IPv6 UDP table: error code {}", result));
        }

        let table = &*(buffer.as_ptr() as *const MIB_UDP6TABLE_OWNER_PID);
        let entries = std::slice::from_raw_parts(
            table.table.as_ptr(),
            table.dwNumEntries as usize,
        );

        let listeners = entries
            .iter()
            .map(|entry| {
                let local_addr = IpAddr::from(entry.ucLocalAddr);
                let local_port = u16::from_be((entry.dwLocalPort as u16).to_le());

                PortInfo {
                    port: local_port,
                    protocol: "UDP".to_string(),
                    state: "LISTENING".to_string(),
                    local_address: format!("[{}]", local_addr),  // IPv6 用方括号
                    remote_address: String::new(),
                    pid: entry.dwOwningPid,
                }
            })
            .collect();

        Ok(listeners)
    }
}

// 合并 IPv4 和 IPv6 UDP 监听
pub fn get_udp_listeners() -> Result<Vec<PortInfo>, String> {
    // 严格模式：两个协议族都必须成功
    let v4 = get_udp_listeners_v4()?;
    let v6 = get_udp_listeners_v6()?;
    
    let mut all_listeners = v4;
    all_listeners.extend(v6);
    
    Ok(all_listeners)
}

// 查询指定端口（IPv4 + IPv6）
pub fn query_port(port: u16, protocol: Option<String>) -> Result<Vec<PortInfo>, String> {
    let mut results = Vec::new();
    let query_tcp = protocol.is_none() || protocol.as_deref() == Some("TCP");
    let query_udp = protocol.is_none() || protocol.as_deref() == Some("UDP");

    // 查询 TCP
    if query_tcp {
        let tcp_connections = get_tcp_connections()?; // 失败直接返回错误
        for conn in tcp_connections {
            if conn.local_port == port {
                results.push(PortInfo {
                    port,
                    protocol: "TCP".to_string(),
                    state: conn.state,
                    local_address: conn.local_address,
                    remote_address: conn.remote_address,
                    pid: conn.pid,
                });
            }
        }
    }
    
    // 查询 UDP
    if query_udp {
        let udp_listeners = get_udp_listeners()?; // 失败直接返回错误
        for listener in udp_listeners {
            if listener.port == port {
                results.push(listener);
            }
        }
    }
    
    // 查询成功，结果为空表示端口真的未占用
    Ok(results)
}

// 查询端口范围（IPv4 + IPv6）
pub fn query_port_range(start: u16, end: u16) -> Result<Vec<PortInfo>, String> {
    let mut results = Vec::new();

    // 查询 TCP - 失败直接返回错误
    let tcp_connections = get_tcp_connections()?;
    for conn in tcp_connections {
        if conn.local_port >= start && conn.local_port <= end {
            results.push(PortInfo {
                port: conn.local_port,
                protocol: "TCP".to_string(),
                state: conn.state,
                local_address: conn.local_address,
                remote_address: conn.remote_address,
                pid: conn.pid,
            });
        }
    }

    // 查询 UDP - 失败直接返回错误
    let udp_listeners = get_udp_listeners()?;
    for listener in udp_listeners {
        if listener.port >= start && listener.port <= end {
            results.push(listener);
        }
    }
    
    // 查询成功，结果为空表示范围内端口真的未占用
    Ok(results)
}

fn get_tcp_state(state: u32) -> String {
    match state {
        1 => "CLOSED",
        2 => "LISTENING",
        3 => "SYN_SENT",
        4 => "SYN_RCVD",
        5 => "ESTABLISHED",
        6 => "FIN_WAIT1",
        7 => "FIN_WAIT2",
        8 => "CLOSE_WAIT",
        9 => "CLOSING",
        10 => "LAST_ACK",
        11 => "TIME_WAIT",
        12 => "DELETE_TCB",
        _ => "UNKNOWN",
    }
    .to_string()
}
