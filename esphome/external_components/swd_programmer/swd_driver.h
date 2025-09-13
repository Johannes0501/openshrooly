#pragma once

#include <stdint.h>

/* IDF or Arduino-ESP32 both provide this */
#if __has_include("driver/gpio.h")
  #include "driver/gpio.h"
#else
  /* very old cores */
  #include "hal/gpio_types.h"
#endif

#ifdef __cplusplus
extern "C" {
#endif


typedef struct {
  gpio_num_t swclk;
  gpio_num_t swdio;
  gpio_num_t rst;
} swd_pins_t;



// -------------------- Constants (copied, with comments) --------------------

// RP2040 target IDs (used in TARGETSEL command to choose a core)
#define RP2040_CORE0_ID 0x01002927
#define RP2040_CORE1_ID 0x11002927

// -------------------- SWD request headers --------------------
// These are the 8-bit request opcodes sent on the SWD wire.
// Format: [Start | APnDP | RnW | Addr | Parity | Stop | Park]
#define SWD_DP_RD_IDCODE   0b10100101  // Read DP register: IDCODE
#define SWD_DP_RD_DLCR     0b10110001  // Read DP register: DLCR
#define SWD_DP_RD_CTRLSTAT 0b10110001  // Read DP register: CTRL/STAT (shares addr with DLCR)
#define SWD_DP_RD_RDBUFF   0b10111101  // Read DP register: RDBUFF
#define SWD_DP_WR_ABORT    0x81        // Write DP register: ABORT
#define SWD_DP_WR_SELECT   0xB1        // Write DP register: SELECT
#define SWD_DP_WR_CTRLSTAT 0b10010101  // Write DP register: CTRL/STAT

// AP register access headers (read/write to Access Port, e.g. memory system)
#define SWD_AP_WR_CSW 0b11011101  // Write Control/Status Word (CSW)
#define SWD_AP_WR_TAR 0b11000101  // Write Transfer Address Register (TAR)
#define SWD_AP_WR_BD0 0b11010001  // Write Banked Data Register 0 (BD0)
#define SWD_AP_WR_DRW 0b11001001  // Write Data Read/Write (DRW)
#define SWD_AP_RD_CSW 0b11111001  // Read CSW
#define SWD_AP_RD_TAR 0b11100001  // Read TAR
#define SWD_AP_RD_BD0 0b11110101  // Read BD0
#define SWD_AP_RD_DRW 0b11101101  // Read DRW

// -------------------- DP SELECT values --------------------
// Values written to SELECT register to switch register banks
#define DP_SELECT_BANK0  0x00000000
#define DP_SELECT_BANK3  0x00000003
#define DP_SELECT_BANK10 0x00000010
#define DP_SELECT_BANK13 0x00000013
#define DP_SELECT_BANKF3 0x000000F3

// -------------------- Memory/register addresses --------------------
// Standard ARM Cortex-M debug system register addresses
#define ADDR_CPUID  0xE000ED00  // CPU ID register
#define ADDR_AIRCR  0xE000ED0C  // Application Interrupt and Reset Control
#define ADDR_DHCSR  0xE000EDF0  // Debug Halting Control and Status
#define ADDR_DCRSR  0xE000EDF4  // Debug Core Register Selector
#define ADDR_DCRDR  0xE000EDF8  // Debug Core Register Data
#define ADDR_DEMCR  0xE000EDFC  // Debug Exception and Monitor Control
#define ADDR_DFSR   0xE000ED30  // Debug Fault Status
// These 0xE0002xxx / 0xE0001xxx seem vendor-specific scratch/debug locations
#define ADDR_2000   0xE0002000
#define ADDR_2008   0xE0002008
#define ADDR_1020   0xE0001020
#define ADDR_1030   0xE0001030

// -------------------- TAR values --------------------
// Addresses written into Transfer Address Register (TAR) for AP access
#define TAR_SRAM_BASE  0x20000000  // Base of RP2040 SRAM
#define TAR_A2000002   0xA2000002  // Magic vendor-specific values (seen in traces)
#define TAR_A2000012   0xA2000012
#define TAR_A2000020   0xA2000020
#define TAR_A2000022   0xA2000022

// -------------------- Control values --------------------
// Values commonly written to ABORT, CTRL/STAT, AIRCR, or DHCSR
#define ABORT_CLEAR_STICKYERR 0x00000010  // Clear sticky error flag
#define ABORT_CLEAR_ALL       0x0000001E  // Clear all sticky error conditions
#define CTRLSTAT_PWRUPREQ     0x50000020  // Power-up debug and system
#define CTRLSTAT_SYSRESET     0x50000000  // System reset request
#define CTRLSTAT_DEBUGEN      0x50000001  // Debug enable
#define AIRCR_SYSRESETREQ     0x05FA0004  // AIRCR: system reset request key
#define DHCSR_RESUME          0xA05F0001  // Resume execution command

// -------------------- Misc --------------------
#define SRAM_PAGE_SIZE 0x400  // 1 KB, often used as block size when programming

void swd_init_connection(const swd_pins_t *pins);
void swd_pico_program_sram(const swd_pins_t *pins, const uint8_t *buffer, uint32_t length);
void perform_full_reset_sequence(const swd_pins_t *pins);
void halt_cores(const swd_pins_t *pins);
void swd_program_sram(const swd_pins_t *pins, const uint8_t *buffer, uint32_t length);
void swd_resume_execution(const swd_pins_t *pins);
uint32_t swd_dp_read_idcode(void);

#ifdef __cplusplus
}
#endif
